function filter(string){

    // Remove all whitepsace characters of node value to match length returned by selection

    return string.replace(/[^\S\u200b]+/gm, '');

}

function getSelection(){

    function findNodeWithOffset(textNodes, offset){

        var characters = 0;

        for(var index = 0; index < textNodes.length; index++){

            var length = filter(textNodes[index].nodeValue).length;
            characters += length;

            if(offset < characters){

                return {node: textNodes[index], offset: offset - (characters - length)};

            }

        }

        return {node: textNodes[textNodes.length - 1], offset: offset - (characters - filter(textNodes[textNodes.length - 1].nodeValue).length)};

    }

    function convertTextNode(node, offset){

        if(node == null){

            return null;

        }
        else if(node.nodeType == Node.TEXT_NODE){
    
            return {node: node, offset: offset};
    
        }
        else{

            var textNodes = allTextNodes(node);
            var textNode = findNodeWithOffset(textNodes, offset).node;

            return {node: textNode, offset: offset};

        }
    
    }

    function adjustEnd(start, end){

        // Polyfill for Firefox

        var characters = 0;
        var lastNode = start.node;

        while(!lastNode.isSameNode(end.node)){

            characters += lastNode.nodeValue.length;
            lastNode = nextTextNode(lastNode, document.body);

            if(lastNode == null){

                return end;

            }

        }

        var calculatedLength = Math.abs(characters - start.offset + end.offset);
        var selectionLength = filter(window.getSelection().toString()).length;

        if(selectionLength != calculatedLength){

            var characters = 0;
            var offset = start.offset + selectionLength;

            var textNodes = [];
            var lastNode = start.node;

            while(lastNode != null){

                textNodes.push(lastNode);
                lastNode = nextTextNode(lastNode, document.body);

            }

            return findNodeWithOffset(textNodes, offset);

        }

        return end;

    }

    var selection = window.getSelection();

    var start = convertTextNode(selection.anchorNode, selection.anchorOffset);
    var end = convertTextNode(selection.focusNode, selection.focusOffset);

    end = end == null ? null : adjustEnd(start, end);

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

function getInfo(container){

    function getAncestors(node, container, result){

        // Get all ancestors up to container

        if(typeof(result) == 'undefined'){

            result = [];

        }

        if(node.parentNode != null && !node.parentNode.isSameNode(container) && !node.parentNode.isSameNode(document.body)){

            result.push(node.parentNode);
            return getAncestors(node.parentNode, container, result);

        }
        else{
        
            return result;

        }

    }

    function nodeIndex(node, nodeList){

        // Get index of text node

        for(var index = 0; index < nodeList.length; index++){

            if(nodeList[index].node.isSameNode(node)){

                return index;

            }

        }

        return -1;

    }

    function nodeRelation(node1, node2, container){

        // Check if node is before or after another node

        var allNodes = allTextNodes(container);

        var allNodes = allNodes.map((value) => {

            return {node: value};

        });

        var index1 = nodeIndex(node1, allNodes);
        var index2 = nodeIndex(node2, allNodes);

        if(index1 >= 0 && index2 >= 0 && index1 > index2){

            return -1;

        }
        else if(index1 >= 0 && index2 >= 0 && index1 < index2){

            return 1;

        }

        return 0;

    }

    function range(ancestor, textNodes, container){

        // Get scope of selection

        var children = allTextNodes(ancestor);

        var characters = 0;
        var total = 0;

        var before = false;
        var after = false;

        for(var index = 0; index < children.length; index++){

            var match = nodeIndex(children[index], textNodes);
            var length = filter(children[index].nodeValue).length;

            if(match >= 0){

                characters += textNodes[match].endOffset - textNodes[match].startOffset;

            }

            total += length;

            // Check if element starts before selection

            if(index == 0 && (nodeRelation(children[index], textNodes[0].node, container) < 0 || textNodes[0].offset)){

                before = true;

            }

            // Check if element starts after selection

            if(index == children.length - 1 && nodeRelation(children[index], textNodes[textNodes.length - 1].node, container) > 0){

                after = true;

            }

        }

        var scope = characters / total;
        var relation = 'parent';

        if(before){

            var relation = 'selectionEndsIn';

        }
        else if(after){

            var relation = 'selectionStartsIn';

        }

        var result = {

            scope: scope,
            nodeCount: children.length,
            relation: relation

        };

        return result;

    }

    function filterAncestors(ancestors, textNodes, container){

        // Return highest parent that is fully included in range

        var bestMatch = null;
        var nodeCount = 0;

        var excluded = [];
        var selectionEndsIn = [];
        var selectionStartsIn = [];

        for(var index = 0; index < ancestors.length; index++){

            var rangeInfo = range(ancestors[index], textNodes, container);

            if(rangeInfo.scope == 1){

                bestMatch = ancestors[index];
                nodeCount = rangeInfo.nodeCount;

            }
            else{

                if(rangeInfo.relation == 'parent'){

                    excluded.push(ancestors[index]);

                }
                else if(rangeInfo.relation == 'selectionEndsIn'){

                    selectionEndsIn.push(ancestors[index]); 

                }
                else if(rangeInfo.relation == 'selectionStartsIn'){

                    selectionStartsIn.push(ancestors[index]); 

                }

            }

        }

        var result = {

            element: bestMatch,
            nodeCount: nodeCount,
            ancestors: excluded,
            selectionEndsIn: selectionEndsIn,
            selectionStartsIn: selectionStartsIn

        };

        return result;

    }

    function trim(node){

        // Trim node value to selection length

        return filter(node.node.nodeValue).substring(node.startOffset, node.endOffset);

    }

    function unique(nodeList){

        // Keep each element only once

        nodeList = nodeList.filter((value, index, self) => {

            return self.indexOf(value) === index;

        });

        return nodeList;

    }

    var selection = getSelection();
    var textNodes = [];

    if(selection != null){

        var start = selection.start;
        var end = selection.end;

        // Get text nodes

        var textNodes = [{
        
            node: start,
            startOffset: selection.startOffset,
            endOffset: filter(start.nodeValue).length
        
        }];

        if(!start.isSameNode(end)){

            var lastTextNode = nextTextNode(start, container);

            while(lastTextNode != null){

                textNodes.push({
                    
                    node: lastTextNode,
                    startOffset: 0,
                    endOffset: filter(lastTextNode.nodeValue).length
                    
                });

                if(lastTextNode.isSameNode(end)){

                    textNodes[textNodes.length - 1].endOffset = selection.endOffset;
                    break;

                }
                else{

                    lastTextNode = nextTextNode(lastTextNode, container);

                }

            }

        }
        else{

            textNodes[0].endOffset = selection.endOffset

        }

        // Get content and relation to elements

        var result = null;

        var content = [];
        var nodeCount = 0;
        var elementCount = 0;
        var ancestors = [];
        var children = [];
        var selectionStartsIn = [];
        var selectionEndsIn = [];

        for(var index = 0; index < textNodes.length; index++){

            var allAncestors = getAncestors(textNodes[index].node, container);

            if(allAncestors.length == 0){

                content.push(trim(textNodes[index]));
                nodeCount++;

            }
            else{

                var element = filterAncestors(allAncestors, textNodes, container);

                if(element.element == null){

                    ancestors = ancestors.concat(element.ancestors);
                    selectionStartsIn = selectionStartsIn.concat(element.selectionStartsIn);
                    selectionEndsIn = selectionEndsIn.concat(element.selectionEndsIn);

                    content.push(trim(textNodes[index]));
                    nodeCount++;

                }
                else{

                    content.push(element.element.outerHTML);
                    children.push(element.element);
                    
                    nodeCount++;
                    elementCount++;

                    index += element.nodeCount - 1;

                }

            }

        }

        // Keep each element only once

        ancestors = unique(ancestors);
        children = unique(children);
        selectionStartsIn = unique(selectionStartsIn);
        selectionEndsIn = unique(selectionEndsIn);

        result = {
            
            content: content.join(''),
            nodeCount: nodeCount,
            elementCount: elementCount,
            ancestors: ancestors,
            parent: ancestors.length > 0 ? ancestors[0] : null,
            children: children,
            selectionStartsIn: selectionStartsIn,
            selectionEndsIn: selectionEndsIn,
            enclosed: selectionStartsIn.length == 0 && selectionEndsIn.length == 0
            
        };

    }

    return result;

}

function normalize(container){

    var selection = getSelection();
    setSelection(selection, container);

}

function collapseToStart(){

    window.getSelection().collapseToStart();

}

function collapseToEnd(){

    window.getSelection().collapseToEnd();

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

function insert(node){

    var selection = window.getSelection();
    var range = selection.getRangeAt(0);

    range.deleteContents();
    range.insertNode(node);

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

        charCount += filter(textNodes[index].nodeValue).length;

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

            if(childNodes[index].nodeType == Node.TEXT_NODE){

                return childNodes[index];

            }
            else{

                var match = searchDescendants(childNodes[index], direction);

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

        if(sibling.nodeType == Node.TEXT_NODE){

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
        lastTextNode = nextTextNode(lastTextNode, container);

    }

    return textNodes;

}

function moveStart(characters, container){

    var selectionBefore = getSelection();

    if(selectionBefore == null){

        return false;

    }
    else{

        var selectionAfter = shift(characters, container, 'start', {...selectionBefore});
        setSelection(selectionAfter, container);
        return compareSelection(selectionBefore, selectionAfter);

    }

}

function moveEnd(characters, container){

    var selectionBefore = getSelection();

    if(selectionBefore == null){

        return false;

    }
    else{

        var selectionAfter = shift(characters, container, 'end', {...selectionBefore});
        setSelection(selectionAfter, container);
        return compareSelection(selectionBefore, selectionAfter);

    }

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

function selectAll(node, container){

    if(node.nodeType == Node.ELEMENT_NODE){

        var textNodes = [node];

    }
    else{

        var textNodes = allTextNodes(node);

    }

    if(textNodes.length > 0){

        var selection = {

            start: textNodes[0],
            startOffset: 0,
            end: textNodes[textNodes.length - 1],
            endOffset: filter(textNodes[textNodes.length - 1].nodeValue).length

        };

        setSelection(selection, container);

    }

}

function moveToStartOfNode(node, container){

    moveTo(node, container, 'start');

}

function moveToEndOfNode(node, container){

    moveTo(node, container, 'end');

}

function moveTo(node, container, direction){

    if(node.nodeType == Node.ELEMENT_NODE){

        var textNodes = allTextNodes(node);

        if(textNodes.length > 0){

            if(direction == 'start'){

                var textNode = textNodes[0];

            }
            else{

                var textNode = textNodes[textNodes.length - 1];

            }

        }

    }
    else{

        var textNode = node;

    }

    if(typeof(textNode) != 'undefined'){

        var offset = direction == 'start' ? 0 : filter(textNode.nodeValue).length;

        var selection = {

            start: textNode,
            startOffset: offset,
            end: textNode,
            endOffset: offset

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

    return selectedElement(selector, container, getSelection().start);

}

function selectedElementEnd(selector, container){

    return selectedElement(selector, container, getSelection().end);

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

function startOfLine(selector, container){

    var selection = getSelection();
    var lastTextNode = null;

    if(selection.startOffset == 0){

        lastTextNode = selection.start;

    }

    if(lastTextNode != null){

        // Ignore empty nodes

        while(lastTextNode.previousSibling != null){

            if(lastTextNode.previousSibling.nodeType == Node.TEXT_NODE && lastTextNode.previousSibling.nodeValue == ''){

                lastTextNode = lastTextNode.previousSibling;

            }
            else{

                break;

            }

        }

        var previousSibling = lastTextNode.previousSibling;

        if(previousSibling == null){

            if(lastTextNode.parentNode != null && (lastTextNode.parentNode.matches(selector) || lastTextNode.parentNode.isSameNode(container))){

                // Start of element

                return true;

            }

        }
        else if(previousSibling.nodeType == Node.ELEMENT_NODE && previousSibling.matches(selector)){

            // In between elements

            return true;

        }

    }

    return false;

}

function endOfLine(selector, container){

    var selection = getSelection();
    var lastTextNode = null;

    if(selection.endOffset == filter(selection.end.nodeValue).length){

        lastTextNode = selection.end;

    }
    else if(selection.endOffset == 0){

        lastTextNode = previousTextNode(selection.end, container);
        
    }

    if(lastTextNode != null){

        // Ignore empty nodes

        while(lastTextNode.nextSibling != null){

            if(lastTextNode.nextSibling.nodeType == Node.TEXT_NODE && lastTextNode.nextSibling.nodeValue == ''){

                lastTextNode = lastTextNode.nextSibling;

            }
            else{

                break;

            }

        }

        var nextSibling = lastTextNode.nextSibling;

        if(nextSibling == null){

            if(lastTextNode.parentNode != null && (lastTextNode.parentNode.matches(selector) || lastTextNode.parentNode.isSameNode(container))){

                // End of element

                return true;

            }

        }
        else if(nextSibling.nodeType == Node.ELEMENT_NODE && nextSibling.matches(selector)){

            // In between elements

            return true;

        }

    }

    return false;

}

function readLine(selector){

    var selection = getSelection();
    var result = '';

    if(selection != null){

        // Get preceding siblings
        
        var lastNode = selection.end;
        var nodes = [selection.end];

        while(lastNode.previousSibling != null && !(lastNode.previousSibling.nodeType == Node.ELEMENT_NODE && lastNode.previousSibling.matches(selector))){

            lastNode = lastNode.previousSibling;
            nodes.unshift(lastNode);

        }

        // Get succeeding siblings
        
        lastNode = selection.end;

        while(lastNode.nextSibling != null && !(lastNode.nextSibling.nodeType == Node.ELEMENT_NODE && lastNode.nextSibling.matches(selector))){

            lastNode = lastNode.nextSibling;
            nodes.push(lastNode);

        }

        // Get values

        var values = nodes.map((node) => {

            if(node.nodeType == Node.ELEMENT_NODE){

                return filter(node.innerText);

            }
            
            return filter(node.nodeValue);

        });

        result = values.join('');

    }

    return result;

}

function moveStartToNextNode(container){

    var selection = getSelection();

    if(selection.startOffset == filter(selection.start.nodeValue).length){

        return moveToNode(container, selection, 'start', 'next');

    }

    return false;

}

function moveStartToPreviousNode(container){

    var selection = getSelection();

    if(selection.startOffset == 0){

        return moveToNode(container, selection, 'start', 'previous');

    }

    return false;

}

function moveEndToNextNode(container){

    var selection = getSelection();

    if(selection.endOffset == filter(selection.end.nodeValue).length){

        return moveToNode(container, selection, 'end', 'next');

    }

    return false;

}

function moveEndToPreviousNode(container){

    var selection = getSelection();

    if(selection.endOffset == 0){

        return moveToNode(container, selection, 'end', 'previous');

    }

    return false;

}

function moveToNode(container, selection, position, direction){

    var lastTextNode = selection[position];

    while(lastTextNode != null){

        if(direction == 'next'){

            lastTextNode = nextTextNode(lastTextNode, container);

        }
        else{

            lastTextNode = previousTextNode(lastTextNode, container);

        }

        if(lastTextNode == null || lastTextNode.nodeValue != ''){

            break;

        }

    }

    if(lastTextNode != null){

        var oldSelection = window.getSelection();
        var range = oldSelection.getRangeAt(0);

        var value = filter(lastTextNode.nodeValue);

        if(direction == 'next'){

            if(position == 'start'){

                if(value.length > 0){

                    // Prevents Safari bug

                    range.setStart(lastTextNode, 1);
                    oldSelection.removeAllRanges();
                    oldSelection.addRange(range);

                }

                range.setStart(lastTextNode, 0);

            }
            else if(position == 'end'){

                if(value.length > 0){

                    // Prevents Safari bug

                    range.setEnd(lastTextNode, 1);
                    oldSelection.removeAllRanges();
                    oldSelection.addRange(range);

                }

                range.setEnd(lastTextNode, 0);

            }

        }
        else{

            if(position == 'start'){

                if(value.length - 1 >= 0){

                    // Prevents Safari bug

                    range.setStart(lastTextNode, value.length - 1);
                    oldSelection.removeAllRanges();
                    oldSelection.addRange(range);

                }

                range.setStart(lastTextNode, value.length);

            }
            else if(position == 'end'){

                if(value.length - 1 >= 0){

                    // Prevents Safari bug

                    range.setEnd(lastTextNode, value.length - 1);
                    oldSelection.removeAllRanges();
                    oldSelection.addRange(range);

                }

                range.setEnd(lastTextNode, value.length);

            }

        }

        oldSelection.removeAllRanges();
        oldSelection.addRange(range);

        return true;

    }

    return false;

}

function onNextChange(callback){

    var event = function(){

        // Called

        callback();
        document.removeEventListener('selectionchange', event);

    };

    document.addEventListener('selectionchange', event);

}

export {filter, getSelection, setSelection, getInfo, normalize, collapseToStart, collapseToEnd, isCollapsed, clear, insert, relativeTo, previousTextNode, nextTextNode, moveStart, moveEnd, selectAll, moveToStartOfNode, moveToEndOfNode, substringStart, substringEnd, selectedElementStart, selectedElementEnd, startOfLine, endOfLine, readLine, moveStartToNextNode, moveStartToPreviousNode, moveEndToNextNode, moveEndToPreviousNode, onNextChange};