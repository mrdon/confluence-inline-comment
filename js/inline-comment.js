var $ = require('speakeasy/jquery').jQuery;

var MAGIC_DELIMITOR = "pw3sx";
var wikiCommentTemplate = AJS.template("{quote}{quoteText}{quote}\n{commentText} {anchorMacro}");
var xhtmlCommentTemplate = AJS.template('<blockquote><p>{quoteText}</p></blockquote>' +
                                        '<p>{commentText} <img class="editor-bodyless-macro" src="https://confxhtml.atlassian.com/plugins/servlet/macro/placeholder/anchor" macro-name="anchor" macro-default-parameter="{anchorValue}" /></p>');
function submitComment(data) {
    var pageId = $('#pageId').val();
    var contextPath = $('#contextPath').val();
    var token = $('meta[name=atlassian-token]').attr('content');
    data.anchorMacro = data.anchorValue ? "{anchor:" + data.anchorValue + "}" : "";
    $.ajax({
        type: 'post',
        url: contextPath + '/pages/doaddcomment.action?pageId=' + pageId,
        data: {
            'content' : wikiCommentTemplate.fill(data),
            'wysiwygContent' : xhtmlCommentTemplate.fill(data),
            'atl_token' : token
        },
        success: function(response)
        {
            alert('Comment added. Refresh the page to see your comment or continue commenting.');
        }
    });
}

/* attempt to find a text selection */
function getSelected() {
    if(window.getSelection) { return window.getSelection(); }
    else if(document.getSelection) { return document.getSelection(); }
    else {
        var selection = document.selection && document.selection.createRange();
        if(selection.text) { return selection.text; }
        return false;
    }
}

function handleSelection(selection) {
    var parsed = selection.split(' ');
    var firstWord = parsed[0];
    var lastWord = parsed[parsed.length-1];
    var numWordsInMiddle = (parsed.length - 2);
    var signature = "";
    var warning = "<p>Warning: Unable to find selection, so the inline notation will not be available.  This could " +
                  "be due you selecting text in a comment or text spanning multiple paragraphs or HTML tags.</p>";
    forEachLinkMatch([{
        firstWord : firstWord,
        lastWord : lastWord,
        numWordsInMiddle : numWordsInMiddle
    }], function(link, textNode, firstWordPos, endPos) {
        warning = "";
        signature = MAGIC_DELIMITOR + firstWord + MAGIC_DELIMITOR + numWordsInMiddle + MAGIC_DELIMITOR + lastWord;
    });

    var dialog = new AJS.Dialog({width:470, height:400});
    dialog.addHeader("Inline Comment");
    dialog.addPanel("Inline Comment",
            warning +
            '<blockquote>' + selection + '</blockquote>' +
            '<textarea id="inlineComment" rows="10" cols="50"></textarea>',
            "panel-body");
    dialog.addButton("Save", function (dialog) {
        submitComment({quoteText: selection, commentText: $('#inlineComment').val(), anchorValue : signature});
        dialog.hide();
    });
    dialog.addButton("Cancel", function (dialog) {
        dialog.hide();
    });

    dialog.show();
    $('#inlineComment').focus();
}

function scanComments() {
    var links = {};
    var counter = 0;
    $('a', '#comments-section').each(function() {
        var name = $(this).attr('name');
        var matches = /.*pw3sx(.*)pw3sx(-?\d+)pw3sx(.*)/.exec(name);
        if (matches) {
            $(this).attr('data-inlineid', counter);
            var commentDiv = $(this).closest('.comment');
            var commentId = commentDiv.attr('id');
            var userId = $('.userLogoLink', commentDiv).attr("data-username");


            var comment = {
                comment : $(this).parent().text(),
                user : userId,
                id : commentId
            };
            var existing = links[matches[0]];
            if (existing) {
                existing.comments.push(comment);
            } else {

                links[matches[0]] = {
                    firstWord  : matches[1],
                    numWordsInMiddle : parseInt(matches[2]),
                    lastWord : matches[3],
                    index : counter++,
                    comments : [comment]
                };
            }
            $(this).attr('href', '#inline-id-' + links[matches[0]].index);
            $(this).append('<img src="' + contextPath + '/images/icons/up_16.gif" />');
        }
    });

    forEachLinkMatch(links, function(link, textNode, firstWordPos, endPos) {
        var text = textNode.nodeValue;
        textNode.nodeValue = text.substring(0, firstWordPos);
        $(textNode).after(
                '<a name="inline-id-' + link.index + '">' +
                '<span id="inline-text-' + link.index + '">' +
                text.substring(firstWordPos, endPos) +
                '</span>' +
                '<sub id="inline-sub-' + link.index + '">' + link.comments.length + '</sub></a> ' + text.substring(endPos));
        AJS.InlineDialog($('#inline-sub-' + link.index), 1, function(contents, trigger, showPopup) {
            contents.empty();
            $.each(link.comments, function() {
                contents.append('<p>' + this.user  + ': ' + this.comment + ' <a href="#' + this.id + '">' +
                        ' <img src="' + contextPath + '/images/icons/down_16.gif" /></a></p>');
            });
            showPopup();
        });

    });
}

function forEachLinkMatch(links, linkHandler)
{
    forEachTextNode('div.wiki-content', function(textNode) {
        var text = textNode.nodeValue;
        var matched = [];
        $.each(links, function(matchText, match) {
            var firstWordPos = text.indexOf(this.firstWord);
            if (firstWordPos > -1) {
                var lastWordPos = text.indexOf(this.lastWord, firstWordPos);
                if (lastWordPos > -1) {
                    var endPos = lastWordPos + this.lastWord.length;
                    var words = text.substring(firstWordPos, endPos).split(' ');
                    if (words.length - 2 == this.numWordsInMiddle) {
                        matched.push(matchText);
                        linkHandler(match, textNode, firstWordPos, endPos);
                    }
                }
            }
        });
        $.each(matched, function() {
            delete links[this];
        });
    });
}

function forEachTextNode(context, callback) {
    $('*', context)
            .andSelf()
            .contents()
            .filter(function(){
                return this.nodeType === 3;
            })
            .filter(function(){
                return this.nodeValue != null && this.nodeValue.length > 0;
            })
            .each(function() {
                callback(this)
            });
}


$(document).ready(function() {
    scanComments();
    AJS.whenIType('shift+c').execute(function() {
        var selection = getSelected();
        if(selection && (selection = new String(selection).replace(/^\s+|\s+$/g,''))) {
            handleSelection(selection);
        }
    });

});
