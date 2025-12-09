let hoveredElement = null;
let currentOverlay = null;
let inspectEnabled = false;
let warningOverlay = null;
let isPinned = false;
let pinnedElement = null;
let pinInstruction = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Track Shift+Z to toggle inspection
document.addEventListener('keydown', function(e) {
  if (e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    inspectEnabled = !inspectEnabled;
    showWarning(inspectEnabled);

    // Clear hover state when toggling off
    if (!inspectEnabled) {
      document.querySelectorAll('.magento-block-hovered').forEach(el => {
        el.classList.remove('magento-block-hovered');
      });
      if (currentOverlay) {
        currentOverlay.remove();
        currentOverlay = null;
      }
      hidePinInstruction();
    }
  }
});

// Show warning message when toggling
function showWarning(enabled) {
  if (warningOverlay) {
    warningOverlay.remove();
  }

  const warning = document.createElement('div');
  warning.className = 'magento-inspector-warning';
  warning.innerHTML = enabled
    ? '<strong>✓ Block Inspector ON</strong> - Hover over elements to inspect'
    : '<strong>✗ Block Inspector OFF</strong>';

  document.body.appendChild(warning);
  warningOverlay = warning;

  // Auto-hide after 2 seconds
  setTimeout(() => {
    if (warningOverlay === warning) {
      warning.remove();
      warningOverlay = null;
    }
  }, 2000);
}

// Parse block/container info from HTML comments
function parseBlockComment(commentText) {
  // Check for CONTAINER NAME
  const containerNameMatch = commentText.match(/CONTAINER NAME:\s*([^\s<]+)/);
  if (containerNameMatch) {
    return {
      type: 'container',
      name: containerNameMatch[1].trim(),
      blockName: containerNameMatch[1].trim(),
      blockClass: '',
      templateName: '',
      templateFile: ''
    };
  }

  // Check for BLOCK NAME
  const blockNameMatch = commentText.match(/BLOCK NAME:\s*([^\s/]+)/);
  const blockClassMatch = commentText.match(/BLOCK CLASS:\s*([^/]+)/);
  const templateNameMatch = commentText.match(/TEMPLATE NAME:\s*([^\s/]+)/);
  const templateFileMatch = commentText.match(/TEMPLATE FILE:\s*([^\s]+)/);

  if (blockNameMatch) {
    return {
      type: 'block',
      name: blockNameMatch[1].trim(),
      blockName: blockNameMatch[1].trim(),
      blockClass: blockClassMatch ? blockClassMatch[1].trim() : '',
      templateName: templateNameMatch ? templateNameMatch[1].trim() : '',
      templateFile: templateFileMatch ? templateFileMatch[1].trim() : ''
    };
  }
  return null;
}

// Store comment information for quick lookup
const commentMap = new Map(); // Maps elements to their direct block/container comment

// Find all block/container comments and map them to their elements
function findBlockElements() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_COMMENT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();

    // Look for opening block comments (not END BLOCK)
    if (text.includes('BLOCK NAME:') && !text.includes('END BLOCK')) {
      const blockInfo = parseBlockComment(text);
      if (blockInfo) {
        // Find the next element node after this comment (could be several nodes away)
        let current = node.nextSibling;
        while (current && current.nodeType !== Node.ELEMENT_NODE) {
          current = current.nextSibling;
        }

        if (current) {
          commentMap.set(current, blockInfo);
          // Also map to parent if the next sibling is not directly the block element
          // This helps catch cases where the comment is followed by text/whitespace
        }
      }
    }
    // Look for opening container comments
    else if (text.includes('CONTAINER NAME:') && !text.includes('END CONTAINER')) {
      const containerInfo = parseBlockComment(text);
      if (containerInfo) {
        // Find the next element node after this comment
        let current = node.nextSibling;
        while (current && current.nodeType !== Node.ELEMENT_NODE) {
          current = current.nextSibling;
        }

        if (current) {
          commentMap.set(current, containerInfo);
        }
      }
    }
  }
}

// Get all parent blocks/containers for an element by walking up the DOM and checking comments
function getBlockHierarchy(element) {
  const hierarchy = [];
  const seen = new Set(); // Track unique blocks by their name to avoid duplicates
  let current = element;

  while (current && current !== document.body) {
    // Check if this element has a corresponding block/container comment
    if (commentMap.has(current)) {
      const info = commentMap.get(current);
      const key = `${info.type}:${info.blockName}`;
      if (!seen.has(key)) {
        hierarchy.unshift(info);
        seen.add(key);
      }
    }

    // Look for comments at current level (previous siblings and parent's previous siblings)
    findCommentsAtLevel(current, hierarchy, seen);

    current = current.parentElement;
  }

  return hierarchy;
}

// Find block/container comments at the current DOM level
function findCommentsAtLevel(element, hierarchy, seen) {
  // Check previous siblings for comments
  let sibling = element.previousSibling;
  const maxChecks = 100; // Prevent infinite loops
  let checks = 0;

  while (sibling && checks < maxChecks) {
    checks++;

    if (sibling.nodeType === Node.COMMENT_NODE) {
      const text = sibling.textContent.trim();
      // Look for opening comments (not END comments)
      if ((text.includes('CONTAINER NAME:') || text.includes('BLOCK NAME:')) &&
          !text.includes('END')) {
        const info = parseBlockComment(text);
        if (info) {
          const key = `${info.type}:${info.blockName}`;
          if (!seen.has(key)) {
            hierarchy.unshift(info);
            seen.add(key);
            // Don't break - keep looking for more blocks at this level
          }
        }
      }
    }

    sibling = sibling.previousSibling;
  }
}

// Create and show the overlay tooltip
function showOverlay(element, x, y) {
  // Only show overlay if inspection is enabled
  if (!inspectEnabled) return;

  const hierarchy = getBlockHierarchy(element);
  if (hierarchy.length === 0) {
    hidePinInstruction();
    return;
  }

  // If pinned, don't follow mouse
  if (isPinned) {
    return; // Keep using the existing pinned overlay
  }

  // Remove old overlay if exists and not pinned
  if (currentOverlay && !isPinned) {
    currentOverlay.remove();
    currentOverlay = null;
  }

  const overlay = document.createElement('div');
  overlay.className = 'magento-block-inspector-tooltip';

  let html = '<div class="block-hierarchy">';

  hierarchy.forEach((block, index) => {
    const typeLabel = block.type === 'container' ? 'CONTAINER' : 'BLOCK';
    const typeClass = block.type === 'container' ? 'container-type' : 'block-type';
    html += `
      <div class="block-item ${typeClass}" style="margin-left: ${index * 16}px;">
        <div class="block-level ${typeClass}">${typeLabel} - Level ${index + 1}</div>
        <div class="block-name"><strong>Name:</strong> ${escapeHtml(block.blockName)}</div>`;

    if (block.blockClass) {
      html += `<div class="block-class"><strong>Class:</strong> ${escapeHtml(block.blockClass)}</div>`;
    }
    if (block.templateName) {
      html += `<div class="block-template"><strong>Template:</strong> ${escapeHtml(block.templateName)}</div>`;
    }
    if (block.templateFile) {
      html += `<div class="block-file"><strong>File:</strong> ${escapeHtml(block.templateFile)}</div>`;
    }

    html += `</div>`;
  });

  html += '</div>';
  overlay.innerHTML = html;

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'magento-tooltip-close';
  closeBtn.innerHTML = '✕';
  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    unpinTooltip();
  });
  overlay.appendChild(closeBtn);

  document.body.appendChild(overlay);

  // Position the tooltip using clientX/Y to handle scroll correctly
  updateTooltipPosition(overlay, x, y);

  currentOverlay = overlay;

  // Show pin instruction
  showPinInstruction(x, y);
}

// Pin the tooltip in place
function pinTooltip(overlay, element, hierarchy) {
  isPinned = true;
  pinnedElement = element;
  overlay.classList.add('pinned');
  hidePinInstruction();

  // Change to fixed position
  const rect = overlay.getBoundingClientRect();
  overlay.style.position = 'fixed';
  overlay.style.top = rect.top + 'px';
  overlay.style.left = rect.left + 'px';

  // Add drag functionality to pinned tooltip
  makeDraggable(overlay);
}

// Make tooltip draggable
function makeDraggable(element) {
  // Create a drag handle in the top-right corner
  const dragHandle = document.createElement('div');
  dragHandle.className = 'magento-tooltip-drag-handle';
  dragHandle.innerHTML = '⋮⋮';
  dragHandle.title = 'Drag to move';
  element.appendChild(dragHandle);

  dragHandle.addEventListener('mousedown', function(e) {
    isDragging = true;
    const rect = element.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    document.addEventListener('mousemove', dragTooltip);
    document.addEventListener('mouseup', stopDragging);

    e.preventDefault();
  });
}

// Drag tooltip with mouse
function dragTooltip(e) {
  if (!isDragging || !currentOverlay || !isPinned) return;

  const newX = e.clientX - dragOffsetX;
  const newY = e.clientY - dragOffsetY;

  currentOverlay.style.left = newX + 'px';
  currentOverlay.style.top = newY + 'px';
}

// Update tooltip position to follow cursor (when not pinned)
function updateTooltipPosition(element, x, y) {
  let top = y + 10;
  let left = x + 10;

  // Check if tooltip goes off-screen
  if (left + element.offsetWidth > window.innerWidth) {
    left = window.innerWidth - element.offsetWidth - 10;
  }
  if (top + element.offsetHeight > window.innerHeight) {
    top = y - element.offsetHeight - 10;
  }

  element.style.top = top + 'px';
  element.style.left = left + 'px';
}

// Stop dragging
function stopDragging() {
  isDragging = false;
  document.removeEventListener('mousemove', dragTooltip);
  document.removeEventListener('mouseup', stopDragging);
}

// Unpin the tooltip
function unpinTooltip() {
  isPinned = false;
  pinnedElement = null;
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
  showPinInstruction(0, 0); // Will be hidden but ensures cleanup
}

// Show pin instruction near cursor
function showPinInstruction(x, y) {
  if (pinInstruction) {
    pinInstruction.remove();
  }

  const instruction = document.createElement('div');
  instruction.className = 'magento-pin-instruction';
  instruction.textContent = 'Press Shift+A to pin';

  document.body.appendChild(instruction);
  pinInstruction = instruction;

  // Position above cursor
  instruction.style.top = (y - 35) + 'px';
  instruction.style.left = (x + 15) + 'px';
}

// Hide pin instruction
function hidePinInstruction() {
  if (pinInstruction) {
    pinInstruction.remove();
    pinInstruction = null;
  }
}

// Add hover listeners to all elements so we can show hierarchy
function attachHoverListeners() {
  // Add a global mousemove listener to the document
  document.addEventListener('mousemove', function(e) {
    if (!inspectEnabled) return;

    // If pinned, don't update on mouse move
    if (isPinned) {
      hidePinInstruction();
      return;
    }

    const element = e.target;
    hoveredElement = element; // Store current hovered element
    const hierarchy = getBlockHierarchy(element);

    if (hierarchy.length === 0) {
      // No blocks found, hide overlay
      if (currentOverlay && !isPinned) {
        currentOverlay.remove();
        currentOverlay = null;
      }
      document.querySelectorAll('.magento-block-hovered').forEach(el => {
        el.classList.remove('magento-block-hovered');
      });
      return;
    }

    // Add highlight to the root element of the innermost block
    document.querySelectorAll('.magento-block-hovered').forEach(el => {
      el.classList.remove('magento-block-hovered');
    });

    // Find the root element of the innermost block
    const innermostBlock = hierarchy[hierarchy.length - 1];
    let current = element;
    while (current && current !== document.body) {
      if (commentMap.has(current)) {
        const info = commentMap.get(current);
        if (info.type === innermostBlock.type && info.blockName === innermostBlock.blockName) {
          current.classList.add('magento-block-hovered');
          break;
        }
      }
      current = current.parentElement;
    }

    showOverlay(element, e.clientX, e.clientY);
  });

  // Hide overlay when mouse leaves the document
  document.addEventListener('mouseleave', function() {
    if (isPinned) return; // Keep pinned overlay visible

    if (currentOverlay) {
      currentOverlay.remove();
      currentOverlay = null;
    }
    document.querySelectorAll('.magento-block-hovered').forEach(el => {
      el.classList.remove('magento-block-hovered');
    });
    hidePinInstruction();
  });
}

// Handle Escape key to unpin and Shift+A to toggle pin
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && isPinned) {
    unpinTooltip();
  } else if (e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    if (isPinned) {
      // Unpin if already pinned
      unpinTooltip();
    } else if (currentOverlay) {
      // Pin the current tooltip
      const hierarchy = getBlockHierarchy(hoveredElement);
      if (hierarchy.length > 0) {
        pinTooltip(currentOverlay, hoveredElement, hierarchy);
      }
    }
  }
});

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


// Initialize the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    findBlockElements();
    attachHoverListeners();
  });
} else {
  findBlockElements();
  attachHoverListeners();
}
