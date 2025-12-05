// ===================================
// CONSTANTS & CONFIGURATION
// ===================================

const EXPORT_WIDTH = 3000;
const EXPORT_HEIGHT = 1800;
const ASPECT_RATIO = EXPORT_WIDTH / EXPORT_HEIGHT; // 5:3
const EDITOR_CANVAS_WIDTH = 1000;
const EDITOR_CANVAS_HEIGHT = EDITOR_CANVAS_WIDTH / ASPECT_RATIO; // 600
const MAX_FILE_SIZE = 1024 * 1024; // 1 MB in bytes
const MIN_JPEG_QUALITY = 0.3;
const INITIAL_JPEG_QUALITY = 0.9;
const QUALITY_STEP = 0.1;
const ZOOM_SENSITIVITY = 0.001;
const MAX_ZOOM_MULTIPLIER = 5;

// ===================================
// STATE MANAGEMENT
// ===================================

let images = []; // Array of image states
let currentIndex = 0;

// Image state structure:
// {
//   file: File object,
//   img: HTMLImageElement,
//   scale: number,
//   offsetX: number,
//   offsetY: number,
//   minScale: number
// }

// ===================================
// DOM ELEMENTS
// ===================================

const imageUpload = document.getElementById('imageUpload');
const editorSection = document.getElementById('editorSection');
const controlsSection = document.getElementById('controlsSection');
const previewSection = document.getElementById('previewSection');
const previewGallery = document.getElementById('previewGallery');
const editorCanvas = document.getElementById('editorCanvas');
const imageInfo = document.getElementById('imageInfo');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const downloadCurrentBtn = document.getElementById('downloadCurrentBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeModal = document.getElementById('closeModal');

const ctx = editorCanvas.getContext('2d', { willReadFrequently: false });

// Set canvas dimensions
editorCanvas.width = EDITOR_CANVAS_WIDTH;
editorCanvas.height = EDITOR_CANVAS_HEIGHT;

// ===================================
// EVENT LISTENERS
// ===================================

imageUpload.addEventListener('change', handleFileUpload);
prevBtn.addEventListener('click', showPreviousImage);
nextBtn.addEventListener('click', showNextImage);
downloadCurrentBtn.addEventListener('click', downloadCurrentImage);
downloadAllBtn.addEventListener('click', downloadAllImages);
helpBtn.addEventListener('click', openHelpModal);
closeModal.addEventListener('click', closeHelpModal);

// Close modal when clicking outside
helpModal.addEventListener('click', (event) => {
    if (event.target === helpModal) {
        closeHelpModal();
    }
});

// Canvas interaction events
editorCanvas.addEventListener('wheel', handleWheel, { passive: false });
editorCanvas.addEventListener('mousedown', startPan);
editorCanvas.addEventListener('mousemove', updatePan);
editorCanvas.addEventListener('mouseup', stopPan);
editorCanvas.addEventListener('mouseleave', stopPan);

// Touch support for mobile
editorCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
editorCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
editorCanvas.addEventListener('touchend', handleTouchEnd);

// ===================================
// PANNING STATE
// ===================================

let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panOffsetX = 0;
let panOffsetY = 0;

// Touch state
let lastTouchDistance = 0;

// ===================================
// HELP MODAL
// ===================================

/**
 * Open the help modal
 */
function openHelpModal() {
    helpModal.classList.add('show');
}

/**
 * Close the help modal
 */
function closeHelpModal() {
    helpModal.classList.remove('show');
}

// ===================================
// FILE UPLOAD HANDLING
// ===================================

/**
 * Handle file upload event
 * @param {Event} event - The file input change event
 */
async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) {
        return;
    }

    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        alert('Please select valid image files.');
        return;
    }

    // Reset state
    images = [];
    currentIndex = 0;

    // Load all images
    for (const file of imageFiles) {
        try {
            const imageState = await loadImage(file);
            images.push(imageState);
        } catch (error) {
            console.error(`Failed to load ${file.name}:`, error);
        }
    }

    if (images.length > 0) {
        // Show editor and controls
        editorSection.style.display = 'flex';
        controlsSection.style.display = 'block';
        previewSection.style.display = 'block';
        
        // Build preview gallery
        buildPreviewGallery();
        
        // Initialize and display first image
        currentIndex = 0;
        displayCurrentImage();
    } else {
        alert('Failed to load any images. Please try again.');
    }
}

/**
 * Load an image file and create initial state
 * @param {File} file - The image file to load
 * @returns {Promise<Object>} - Promise that resolves to image state object
 */
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            
            // Calculate minimum scale to cover the frame
            const scaleX = EDITOR_CANVAS_WIDTH / img.width;
            const scaleY = EDITOR_CANVAS_HEIGHT / img.height;
            const minScale = Math.max(scaleX, scaleY);

            const imageState = {
                file: file,
                img: img,
                scale: minScale,
                offsetX: 0,
                offsetY: 0,
                minScale: minScale
            };

            // Initialize with centered position
            initImageState(imageState);
            
            resolve(imageState);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`Failed to load image: ${file.name}`));
        };

        img.src = url;
    });
}

/**
 * Initialize image state with proper centering
 * @param {Object} imageState - The image state to initialize
 */
function initImageState(imageState) {
    const { img, scale } = imageState;
    
    // Calculate scaled dimensions
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    
    // Center the image in the canvas
    imageState.offsetX = (EDITOR_CANVAS_WIDTH - scaledWidth) / 2;
    imageState.offsetY = (EDITOR_CANVAS_HEIGHT - scaledHeight) / 2;
}

// ===================================
// IMAGE DISPLAY & DRAWING
// ===================================

/**
 * Build the preview gallery with thumbnails
 */
function buildPreviewGallery() {
    // Clear existing thumbnails
    previewGallery.innerHTML = '';
    
    images.forEach((imageState, index) => {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'preview-thumbnail';
        if (index === currentIndex) {
            thumbnail.classList.add('active');
        }
        
        const img = document.createElement('img');
        img.src = imageState.img.src;
        img.alt = imageState.file.name;
        
        thumbnail.appendChild(img);
        
        // Click handler to switch to this image
        thumbnail.addEventListener('click', () => {
            currentIndex = index;
            displayCurrentImage();
            updatePreviewSelection();
        });
        
        previewGallery.appendChild(thumbnail);
    });
}

/**
 * Update which thumbnail is marked as active
 */
function updatePreviewSelection() {
    const thumbnails = previewGallery.querySelectorAll('.preview-thumbnail');
    thumbnails.forEach((thumb, index) => {
        if (index === currentIndex) {
            thumb.classList.add('active');
        } else {
            thumb.classList.remove('active');
        }
    });
}

/**
 * Display the current image in the editor
 */
function displayCurrentImage() {
    if (images.length === 0) return;

    const imageState = images[currentIndex];
    
    // Update UI
    updateImageInfo();
    updateNavigationButtons();
    updatePreviewSelection();
    
    // Draw the image
    drawEditorImage();
}

/**
 * Update the image info text
 */
function updateImageInfo() {
    const imageState = images[currentIndex];
    const total = images.length;
    const current = currentIndex + 1;
    const filename = imageState.file.name;
    
    imageInfo.textContent = `Image ${current} of ${total} — ${filename}`;
}

/**
 * Update navigation button states
 */
function updateNavigationButtons() {
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === images.length - 1;
    
    // Disable buttons if only one image
    if (images.length === 1) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    }
}

/**
 * Draw the current image on the editor canvas
 */
function drawEditorImage() {
    if (images.length === 0) return;

    const imageState = images[currentIndex];
    const { img, scale, offsetX, offsetY } = imageState;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, EDITOR_CANVAS_WIDTH, EDITOR_CANVAS_HEIGHT);

    // Calculate scaled dimensions
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    // Draw image
    ctx.drawImage(
        img,
        offsetX,
        offsetY,
        scaledWidth,
        scaledHeight
    );
}

// ===================================
// NAVIGATION
// ===================================

/**
 * Show the previous image
 */
function showPreviousImage() {
    if (currentIndex > 0) {
        currentIndex--;
        displayCurrentImage();
    }
}

/**
 * Show the next image
 */
function showNextImage() {
    if (currentIndex < images.length - 1) {
        currentIndex++;
        displayCurrentImage();
    }
}

// ===================================
// ZOOM FUNCTIONALITY
// ===================================

/**
 * Handle mouse wheel for zooming
 * @param {WheelEvent} event - The wheel event
 */
function handleWheel(event) {
    event.preventDefault();

    if (images.length === 0) return;

    const imageState = images[currentIndex];
    
    // Apply zoom
    applyZoom(event.deltaY, imageState);
    
    // Redraw
    drawEditorImage();
}

/**
 * Apply zoom to the image
 * @param {number} deltaY - The wheel delta value
 * @param {Object} imageState - The current image state
 */
function applyZoom(deltaY, imageState) {
    const { minScale } = imageState;
    const maxScale = minScale * MAX_ZOOM_MULTIPLIER;
    
    // Calculate zoom factor
    const zoomFactor = 1 - deltaY * ZOOM_SENSITIVITY;
    
    // Calculate new scale
    let newScale = imageState.scale * zoomFactor;
    
    // Clamp scale
    newScale = Math.max(minScale, Math.min(maxScale, newScale));
    
    // Calculate scale change ratio
    const scaleRatio = newScale / imageState.scale;
    
    // Get mouse position relative to canvas
    const rect = editorCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Scale canvas coordinates to actual canvas size
    const canvasMouseX = (mouseX / rect.width) * EDITOR_CANVAS_WIDTH;
    const canvasMouseY = (mouseY / rect.height) * EDITOR_CANVAS_HEIGHT;
    
    // Adjust offset to zoom towards mouse position
    imageState.offsetX = canvasMouseX - (canvasMouseX - imageState.offsetX) * scaleRatio;
    imageState.offsetY = canvasMouseY - (canvasMouseY - imageState.offsetY) * scaleRatio;
    
    // Update scale
    imageState.scale = newScale;
    
    // Apply panning constraints
    constrainPan(imageState);
}

// ===================================
// PAN FUNCTIONALITY
// ===================================

/**
 * Start panning on mouse down
 * @param {MouseEvent} event - The mouse down event
 */
function startPan(event) {
    if (images.length === 0) return;

    isPanning = true;
    
    const rect = editorCanvas.getBoundingClientRect();
    panStartX = event.clientX - rect.left;
    panStartY = event.clientY - rect.top;
    
    const imageState = images[currentIndex];
    panOffsetX = imageState.offsetX;
    panOffsetY = imageState.offsetY;
}

/**
 * Update pan position on mouse move
 * @param {MouseEvent} event - The mouse move event
 */
function updatePan(event) {
    if (!isPanning || images.length === 0) return;

    const rect = editorCanvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;
    
    // Calculate delta in canvas coordinates
    const deltaX = ((currentX - panStartX) / rect.width) * EDITOR_CANVAS_WIDTH;
    const deltaY = ((currentY - panStartY) / rect.height) * EDITOR_CANVAS_HEIGHT;
    
    const imageState = images[currentIndex];
    
    // Update offset
    imageState.offsetX = panOffsetX + deltaX;
    imageState.offsetY = panOffsetY + deltaY;
    
    // Apply panning constraints
    constrainPan(imageState);
    
    // Redraw
    drawEditorImage();
}

/**
 * Stop panning on mouse up or leave
 */
function stopPan() {
    isPanning = false;
}

/**
 * Constrain panning so image can be positioned freely
 * This allows non-destructive cropping - users can position any part of the image
 * @param {Object} imageState - The image state to constrain
 */
function constrainPan(imageState) {
    const { img, scale } = imageState;
    
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    
    // Allow full freedom of movement - no constraints
    // This enables non-destructive cropping where users can choose
    // exactly what part of their image to export
    // The original image is never actually cropped, only the framed area is exported
}

// ===================================
// TOUCH SUPPORT
// ===================================

/**
 * Handle touch start
 * @param {TouchEvent} event - The touch start event
 */
function handleTouchStart(event) {
    event.preventDefault();
    
    if (images.length === 0) return;

    if (event.touches.length === 1) {
        // Single touch - panning
        const touch = event.touches[0];
        const rect = editorCanvas.getBoundingClientRect();
        
        isPanning = true;
        panStartX = touch.clientX - rect.left;
        panStartY = touch.clientY - rect.top;
        
        const imageState = images[currentIndex];
        panOffsetX = imageState.offsetX;
        panOffsetY = imageState.offsetY;
    } else if (event.touches.length === 2) {
        // Pinch zoom
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        lastTouchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
    }
}

/**
 * Handle touch move
 * @param {TouchEvent} event - The touch move event
 */
function handleTouchMove(event) {
    event.preventDefault();
    
    if (images.length === 0) return;

    if (event.touches.length === 1 && isPanning) {
        // Single touch - panning
        const touch = event.touches[0];
        const rect = editorCanvas.getBoundingClientRect();
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;
        
        const deltaX = ((currentX - panStartX) / rect.width) * EDITOR_CANVAS_WIDTH;
        const deltaY = ((currentY - panStartY) / rect.height) * EDITOR_CANVAS_HEIGHT;
        
        const imageState = images[currentIndex];
        imageState.offsetX = panOffsetX + deltaX;
        imageState.offsetY = panOffsetY + deltaY;
        
        constrainPan(imageState);
        drawEditorImage();
    } else if (event.touches.length === 2) {
        // Pinch zoom
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        if (lastTouchDistance > 0) {
            const delta = (lastTouchDistance - currentDistance) * 2;
            const imageState = images[currentIndex];
            
            // Create a synthetic event for zoom
            const syntheticEvent = {
                deltaY: delta,
                clientX: (touch1.clientX + touch2.clientX) / 2,
                clientY: (touch1.clientY + touch2.clientY) / 2,
                preventDefault: () => {}
            };
            
            applyZoom(delta, imageState);
            drawEditorImage();
        }
        
        lastTouchDistance = currentDistance;
    }
}

/**
 * Handle touch end
 */
function handleTouchEnd() {
    isPanning = false;
    lastTouchDistance = 0;
}

// ===================================
// EXPORT FUNCTIONALITY
// ===================================

/**
 * Download the current image
 */
async function downloadCurrentImage() {
    if (images.length === 0) return;

    downloadCurrentBtn.disabled = true;
    downloadCurrentBtn.innerHTML = '<span>⏳ Processing...</span>';

    try {
        const imageState = images[currentIndex];
        await exportSingleImage(imageState);
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export image. Please try again.');
    } finally {
        downloadCurrentBtn.disabled = false;
        downloadCurrentBtn.innerHTML = '<span>📥 Download this image</span>';
    }
}

/**
 * Download all images
 */
async function downloadAllImages() {
    if (images.length === 0) return;

    downloadAllBtn.disabled = true;
    
    for (let i = 0; i < images.length; i++) {
        downloadAllBtn.innerHTML = `<span>⏳ Processing ${i + 1}/${images.length}...</span>`;
        
        try {
            await exportSingleImage(images[i]);
            
            // Small delay between downloads to prevent browser blocking
            if (i < images.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.error(`Failed to export image ${i + 1}:`, error);
        }
    }

    downloadAllBtn.disabled = false;
    downloadAllBtn.innerHTML = '<span>📦 Download all</span>';
}

/**
 * Export a single image with proper scaling
 * @param {Object} imageState - The image state to export
 */
async function exportSingleImage(imageState) {
    const { img, scale, offsetX, offsetY, file } = imageState;

    // Create export canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_WIDTH;
    exportCanvas.height = EXPORT_HEIGHT;
    const exportCtx = exportCanvas.getContext('2d', { willReadFrequently: false });

    // Calculate scale ratio from editor to export
    const scaleRatio = EXPORT_WIDTH / EDITOR_CANVAS_WIDTH;

    // Calculate export dimensions and position
    const exportScale = scale * scaleRatio;
    const exportOffsetX = offsetX * scaleRatio;
    const exportOffsetY = offsetY * scaleRatio;
    const exportScaledWidth = img.width * exportScale;
    const exportScaledHeight = img.height * exportScale;

    // Fill background
    exportCtx.fillStyle = '#000000';
    exportCtx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

    // Draw image
    exportCtx.drawImage(
        img,
        exportOffsetX,
        exportOffsetY,
        exportScaledWidth,
        exportScaledHeight
    );

    // Generate filename
    const originalName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
    const filename = `${originalName}_reframed.jpg`;

    // Export with size constraint
    await exportJpegWithMaxSize(exportCanvas, filename, MAX_FILE_SIZE);
}

/**
 * Export canvas as JPEG with adaptive quality to meet size constraint
 * @param {HTMLCanvasElement} canvas - The canvas to export
 * @param {string} filename - The filename for the download
 * @param {number} maxBytes - Maximum file size in bytes
 */
function exportJpegWithMaxSize(canvas, filename, maxBytes) {
    return new Promise((resolve, reject) => {
        let quality = INITIAL_JPEG_QUALITY;

        /**
         * Try to export with current quality
         */
        const tryExport = () => {
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create blob'));
                        return;
                    }

                    // Check if size is acceptable or quality is at minimum
                    if (blob.size <= maxBytes || quality <= MIN_JPEG_QUALITY) {
                        // Trigger download
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);

                        // Log export info
                        console.log(`Exported ${filename}: ${(blob.size / 1024).toFixed(2)} KB at quality ${quality.toFixed(2)}`);
                        
                        resolve();
                    } else {
                        // Reduce quality and try again
                        quality = Math.max(MIN_JPEG_QUALITY, quality - QUALITY_STEP);
                        tryExport();
                    }
                },
                'image/jpeg',
                quality
            );
        };

        tryExport();
    });
}

// ===================================
// INITIALIZATION
// ===================================

// Log initialization
console.log('Reframe Image Editor initialized');
console.log(`Export resolution: ${EXPORT_WIDTH}×${EXPORT_HEIGHT}`);
console.log(`Editor canvas: ${EDITOR_CANVAS_WIDTH}×${EDITOR_CANVAS_HEIGHT}`);
