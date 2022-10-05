function getSelection(){

    function convertTextNode(node, offset, position){

        if(node.nodeType == Node.TEXT_NODE){
    
            return {node: node, offset: offset};
    
        }
        else if(position == 'start'){
    
            var textNode = firstTextNode(node);
            return {node: textNode, offset: 0};
    
        }
        else{

            var textNodes = allTextNodes(node);
            var textNode = textNodes[textNodes.length - 1];

            return {node: textNode, offset: textNode.nodeValue.length};

        }
    
    }

    var selection = window.getSelection();

    var start = convertTextNode(selection.anchorNode, selection.anchorOffset, 'start');
    var end = convertTextNode(selection.focusNode, selection.focusOffset, 'end');

    if(start != null && end != null){

        var result = {

            start: start.node,
            startOffset: start.offset,
            end: end.node,
            endOffset: end.offset

        };

    }
    else{

        var result = null;

    }

    return result;

}

function setSelection(selection, container){

    var relativeSelection = toRelativeSelection(selection, container);

    var oldSelection = window.getSelection();
    var range = document.createRange();
    
    if(relativeSelection.start > relativeSelection.end){

        range.setStart(selection.end, selection.endOffset);
        range.setEnd(selection.start, selection.startOffset);

    }
    else{

        range.setStart(selection.start, selection.startOffset);
        range.setEnd(selection.end, selection.endOffset);

    }
    
    oldSelection.removeAllRanges();
    oldSelection.addRange(range);

}

function collapse(){

    window.getSelection().collapseToStart();

}

function isCollapsed(){

    return window.getSelection().isCollapsed;

}

function clear(container){

    var selection = window.getSelection();
    var range = selection.getRangeAt(0);
    range.deleteContents();

    var helperNode = document.createTextNode('');

    range.insertNode(helperNode);
    moveTo(helperNode, container);

}

function relativeTo(container){

    return toRelativeSelection(getSelection(), container);

}

function toRelativeSelection(selection, container){

    var textNodes = allTextNodes(container);

    var result = {

        start: -1,
        end: -1

    };

    var charCount = 0;

    for(var index = 0; index < textNodes.length; index++){

        // Start

        if(textNodes[index].isSameNode(selection.start)){

            result.start = charCount + selection.startOffset;

        }

        // End
        
        if(textNodes[index].isSameNode(selection.end)){

            result.end = charCount + selection.endOffset;

        }

        charCount += textNodes[index].nodeValue.length;

    }

    return result;

}

function firstTextNode(element){

    if(element != null){

        if(element.nodeType == Node.TEXT_NODE){

            return element;

        }
        else if(element.childNodes.length > 0){

            for(var index = 0; index < element.childNodes.length; index++){

                var child = firstTextNode(element.childNodes[index]);

                if(child != null){

                    return child;

                }

            }

        }

    }
    
    return null;

}

function previousTextNode(lastNode, container){

    return adjacentTextNode(lastNode, container, 'previous');

}

function nextTextNode(lastNode, container){

    return adjacentTextNode(lastNode, container, 'next');

}

function adjacentTextNode(lastNode, container, direction){

    function searchDescendants(node, direction){

        var childNodes = node.childNodes;

        if(direction == 'next'){

            var startIndex = 0;
            var endIndex = childNodes.length;
            var increment = 1;
            
            var compare = (currentIndex, endIndex) => {

                return currentIndex < endIndex;

            };

        }
        else{

            var startIndex = childNodes.length - 1;
            var endIndex = 0;
            var increment = -1;

            var compare = (currentIndex, endIndex) => {

                return currentIndex >= endIndex;

            };
            
        }

        for(var index = startIndex; compare(index, endIndex); index += increment){

            if(childNodes[index].nodeType == Node.TEXT_NODE && childNodes[index].nodeValue.length > 0){

                return childNodes[index];

            }
            else{

                var match = searchDescendants(childNodes[index]);

                if(match != null){

                    return match;

                }
                
            }

        }

        return null;

    }

    if(direction == 'next'){

        var sibling = lastNode.nextSibling;

    }
    else{

        var sibling = lastNode.previousSibling;

    }

    if(sibling != null){

        // Search sibling

        if(sibling.nodeType == Node.TEXT_NODE && sibling.nodeValue.length > 0){

            // Sibling is text node

            return sibling;

        }
        else{

            // Search descendants

            var match = searchDescendants(sibling, direction);

            if(match != null){

                return match;

            }
            else{

                return adjacentTextNode(sibling, container, direction);

            }

        }

    }
    else{

        // Search parent

        if(!lastNode.parentNode.isSameNode(container) && !lastNode.parentNode.isSameNode(document.body)){

            return adjacentTextNode(lastNode.parentNode, container, direction);

        }
        else{

            return null;

        }

    }

}

function allTextNodes(container){

    var textNodes = [];

    var lastTextNode = firstTextNode(container);

    while(lastTextNode != null){

        textNodes.push(lastTextNode);
        lastTextNode = nextTextNode(lastTextNode);

    }

    return textNodes;

}

function move(characters, container){

    var selectionBefore = getSelection();
    var selectionAfter = shift(characters, container, 'start', {...selectionBefore});

    // Collapse

    selectionAfter.end = selectionAfter.start;
    selectionAfter.endOffset = selectionAfter.startOffset;

    setSelection(selectionAfter, container);

    return compareSelection(selectionBefore, selectionAfter);

}

function moveStart(characters, container){

    var selectionBefore = getSelection();
    var selectionAfter = shift(characters, container, 'start', {...selectionBefore});

    setSelection(selectionAfter, container);

    return compareSelection(selectionBefore, selectionAfter);

}

function moveEnd(characters, container){

    var selectionBefore = getSelection();
    var selectionAfter = shift(characters, container, 'end', {...selectionBefore});

    setSelection(selectionAfter, container);

    return compareSelection(selectionBefore, selectionAfter);

}

function shift(characters, container, direction, selection){

    var target = selection[direction];
    var offset = selection[direction + 'Offset'];

    // Check if range leaves node

    if(offset + characters > target.nodeValue.length){

        var rest = characters - (target.nodeValue.length - offset);
        selection[direction + 'Offset'] = target.nodeValue.length;

    }
    else if(offset + characters < 0){

        var rest = characters + offset;
        selection[direction + 'Offset'] = 0;

    }
    else{

        var rest = 0;
        selection[direction + 'Offset'] = offset + characters;

    }

    // Move to node or return result

    if(rest < 0 || (characters < 0 && offset + characters == 0)){

        // Move to previous node

        var previousNode = previousTextNode(target, container);

        if(previousNode != null){

            selection[direction] = previousNode;
            selection[direction + 'Offset'] = previousNode.nodeValue.length;

            return shift(rest, container, direction, selection);

        }

    }
    else if(rest > 0 || (characters > 0 && offset + characters == target.nodeValue.length)){

        // Move to next node

        var nextNode = nextTextNode(target, container);

        if(nextNode != null){

            selection[direction] = nextNode;
            selection[direction + 'Offset'] = 0;

            return shift(rest, container, direction, selection);

        }

    }

    return selection;

}

function compareSelection(selection1, selection2){

    return !(selection1.start.isSameNode(selection2.start) && selection1.end.isSameNode(selection2.end) && selection1.startOffset == selection2.startOffset && selection1.endOffset == selection2.endOffset);

}

function moveTo(node, container){

    if(node.nodeType == Node.ELEMENT_NODE){

        var textNodes = allTextNodes(container);

        if(textNodes.length > 0){

            var textNode = textNodes[textNodes.length - 1];

        }

    }
    else{

        var textNode = node;

    }

    if(typeof(textNode) != 'undefined'){

        var selection = {

            start: textNode,
            startOffset: textNode.nodeValue.length,
            end: textNode,
            endOffset: textNode.nodeValue.length

        };

        setSelection(selection, container);

    }

}

function stringValue(start, startOffset, end, endOffset){

    var range = window.getSelection().getRangeAt(0).cloneRange();

    range.setStart(start, startOffset);
    range.setEnd(end, endOffset);

    return range.toString();

}

function substringStart(characters, container){

    return substring(characters, container, 'start');

}

function substringEnd(characters, container){

    return substring(characters, container, 'end');

}

function substring(characters, container, direction){

    var selection = getSelection();

    // Range start

    if(direction == 'start'){

        var start = selection.start;
        var startOffset = selection.startOffset;

    }
    else{

        var start = selection.end;
        var startOffset = selection.endOffset;

    }

    // Range end

    var end = container;

    if(characters < 0){

        var endOffset = 0;
        var string = stringValue(end, endOffset, start, startOffset);

    }
    else if(characters > 0){

        var endOffset = container.childNodes.length;
        var string = stringValue(start, startOffset, end, endOffset);

    }
    else{

        return '';

    }

    if(string.length < characters){

        return string;

    }
    else if(characters < 0){

        return string.substring(string.length + characters);

    }
    else{

        return string.substring(0, characters);

    }

}

function selectedElementStart(selector, container){

    return selectedElement(selector, container, window.getSelection().anchorNode);

}

function selectedElementEnd(selector, container){

    return selectedElement(selector, container, window.getSelection().focusNode);

}

function selectedElement(selector, container, element){

    if(typeof(element) == 'undefined' || element == null){

        return null;

    }
    else if(element.nodeType == Node.ELEMENT_NODE && element.matches(selector)){

        return element;

    }
    else if(element.isSameNode(container) || element.isSameNode(document.body)){

        return null;

    }
    else{

        return selectedElement(selector, container, element.parentNode);

    }

}

function elementBefore(selector, container){

    var oldSelection = getSelection();

    collapse(container);
    moveStart(-1, container);
    moveEnd(1, container);
    
    var selection = getSelection();

    if(selection.start.isSameNode(selection.end)){

        var result = selectedElement(selector, container, selection.start);

    }
    else{

        var result = selectedElement(selector, container, nextTextNode(selection.start, container));

    }

    // Reset selectin

    setSelection(oldSelection, container);

    return result;

}

function onNextChange(callback){

    var event = function(){

        // Called

        callback();
        document.removeEventListener('selectionchange', event);

    };

    document.addEventListener('selectionchange', event);

}

export {collapse, isCollapsed, clear, relativeTo, previousTextNode, nextTextNode, move, moveStart, moveEnd, moveTo, substringStart, substringEnd, selectedElementStart, selectedElementEnd, elementBefore, onNextChange};