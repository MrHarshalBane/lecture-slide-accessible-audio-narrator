document.addEventListener('DOMContentLoaded', () => {

    // App State
    let currentSlides = [];
    let currentSlideIndex = 0;
    let currentNarration = null;
    let audioSegments = [];
    let isPlaying = false;
    let logPollInterval = null;

    // DOM Elements
    const fileInput = document.getElementById('file-input');
    const demoButtons = document.querySelectorAll('.btn-demo');

    const slideTitle = document.getElementById('slide-title-display');
    const slideCounter = document.getElementById('slide-counter');
    const slideImg = document.getElementById('slide-canvas-img');
    const bboxOverlay = document.getElementById('bbox-overlay');
    const loadingSpinner = document.getElementById('loading-spinner');
    const loadingText = document.getElementById('loading-text');

    const btnPrev = document.getElementById('btn-prev-slide');
    const btnNext = document.getElementById('btn-next-slide');

    const metaType = document.getElementById('meta-type');
    const metaConfidence = document.getElementById('meta-confidence');
    const metaElements = document.getElementById('meta-elements');

    const engineBadge = document.getElementById('engine-badge');
    const audioElement = document.getElementById('audio-element');
    const btnPlayPause = document.getElementById('btn-play-pause');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    const seekbar = document.getElementById('audio-seekbar');
    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');
    const selectSpeed = document.getElementById('select-speed');

    const transcriptBody = document.getElementById('transcript-body');
    const logsConsole = document.getElementById('logs-console');
    const ariaStatus = document.getElementById('aria-status');

    const btnContrast = document.getElementById('btn-contrast');
    const btnDyslexia = document.getElementById('btn-dyslexia');
    const btnLogsToggle = document.getElementById('btn-logs-toggle');
    const logsPanel = document.getElementById('terminal-logs-panel');
    const btnClearLogs = document.getElementById('btn-clear-logs');

    const btnDownloadMp3 = document.getElementById('btn-download-mp3');
    const btnDownloadTxt = document.getElementById('btn-download-txt');

    // Accessibility Screen Reader Helper
    function announce(msg) {
        if (ariaStatus) {
            ariaStatus.textContent = msg;
        }
    }

    // Initialize - Load Default Demo Deck (Biology Hierarchy)
    loadDemoDeck('biology');
    startLogPolling();

    // Event Listeners - Demo Decks
    demoButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            demoButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const deckName = btn.dataset.deck;
            loadDemoDeck(deckName);
        });
    });

    // File Upload Handler
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        showLoading(`Uploading and parsing ${file.name}...`);

        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                currentSlides = data.slides;
                currentSlideIndex = 0;
                announce(`Successfully uploaded and parsed ${file.name}. ${data.slide_count} slides available.`);
                renderSlide(0);
            } else {
                alert(`Upload error: ${data.message}`);
                hideLoading();
            }
        })
        .catch(err => {
            console.error(err);
            alert('Failed to upload file.');
            hideLoading();
        });
    });

    // Load Demo Deck Function
    function loadDemoDeck(deckName) {
        showLoading(`Loading demo lecture deck (${deckName})...`);

        fetch(`/api/demo-slides?deck=${deckName}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                currentSlides = data.slides;
                currentSlideIndex = 0;
                announce(`Loaded ${data.deck_name} demo deck with ${data.slide_count} slides.`);
                renderSlide(0);
            } else {
                alert(`Error loading demo deck: ${data.message}`);
                hideLoading();
            }
        })
        .catch(err => {
            console.error(err);
            alert('Failed to connect to backend server.');
            hideLoading();
        });
    }

    // Render Slide
    function renderSlide(index) {
        if (!currentSlides || currentSlides.length === 0) return;
        if (index < 0) index = 0;
        if (index >= currentSlides.length) index = currentSlides.length - 1;

        currentSlideIndex = index;
        const slide = currentSlides[currentSlideIndex];

        // Update UI Text
        slideTitle.textContent = `Slide ${slide.slide_index}: ${slide.title}`;
        slideCounter.textContent = `Slide ${currentSlideIndex + 1} / ${currentSlides.length}`;

        // Set Slide Image
        slideImg.src = slide.image_base64 || slide.image_url;

        // Render Shapes & Bounding Box Overlays
        renderBoundingBoxes(slide.shapes);

        // Pause current audio
        pauseAudio();

        // Analyze Slide Diagram & Generate Narration
        showLoading(`Analyzing Slide #${slide.slide_index} visual graphics & diagram topology...`);

        fetch('/api/analyze-slide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slide: slide })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                const diagram = data.diagram;
                currentNarration = data.narration;

                // Update Diagram Meta Bar
                metaType.textContent = formatDiagramType(diagram.diagram_type);
                metaConfidence.textContent = `${Math.round(diagram.confidence * 100)}%`;
                metaElements.textContent = `${diagram.element_count} nodes`;

                engineBadge.textContent = currentNarration.engine_used;

                // Render Transcript
                renderTranscript(currentNarration);

                // Synthesize TTS Audio
                synthesizeNarrationAudio(currentNarration.narrative_text);
            } else {
                hideLoading();
            }
        })
        .catch(err => {
            console.error(err);
            hideLoading();
        });
    }

    function formatDiagramType(type) {
        const map = {
            'HIERARCHY_TREE': 'Evolutionary Hierarchy Tree',
            'FLOWCHART': 'Algorithmic Flowchart',
            'LINEAR_PROCESS': 'Process Lifecycle Flow',
            'DATA_CHART': 'Data Graph & Chart',
            'GENERAL_DIAGRAM': 'Structured Visual Diagram'
        };
        return map[type] || type;
    }

    // Render Bounding Boxes on Slide Canvas
    function renderBoundingBoxes(shapes) {
        bboxOverlay.innerHTML = '';
        if (!shapes) return;

        shapes.forEach(shape => {
            if (!shape.text) return;
            const bbox = shape.bbox;

            const boxEl = document.createElement('div');
            boxEl.className = 'bbox-box';
            boxEl.style.left = `${bbox.x}%`;
            boxEl.style.top = `${bbox.y}%`;
            boxEl.style.width = `${bbox.w}%`;
            boxEl.style.height = `${bbox.h}%`;
            boxEl.id = `box_${shape.id}`;
            boxEl.title = `${shape.name}: ${shape.text}`;

            boxEl.addEventListener('click', () => {
                highlightBox(shape.id);
                announce(`Selected element: ${shape.text}`);
            });

            bboxOverlay.appendChild(boxEl);
        });
    }

    function highlightBox(shapeId) {
        document.querySelectorAll('.bbox-box').forEach(b => b.classList.remove('active-highlight'));
        if (!shapeId) return;
        const target = document.getElementById(`box_${shapeId}`);
        if (target) {
            target.classList.add('active-highlight');
        }
    }

    // Render Transcript Sentences
    function renderTranscript(narration) {
        transcriptBody.innerHTML = '';
        audioSegments = narration.segments || [];

        if (audioSegments.length === 0) {
            transcriptBody.innerHTML = `<p class="placeholder-text">${narration.narrative_text}</p>`;
            return;
        }

        audioSegments.forEach((seg, idx) => {
            const span = document.createElement('span');
            span.className = 'transcript-sentence';
            span.dataset.index = idx;
            span.dataset.time = seg.time_offset;
            span.textContent = seg.text + ' ';

            span.addEventListener('click', () => {
                if (audioElement.duration) {
                    audioElement.currentTime = seg.time_offset;
                    playAudio();
                    highlightTranscriptSentence(idx);
                }
            });

            transcriptBody.appendChild(span);
        });
    }

    function highlightTranscriptSentence(index) {
        document.querySelectorAll('.transcript-sentence').forEach(s => s.classList.remove('active-speaking'));
        const targetSpan = transcriptBody.querySelector(`[data-index="${index}"]`);
        if (targetSpan) {
            targetSpan.classList.add('active-speaking');
            targetSpan.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // Highlight associated diagram shape if available
            const seg = audioSegments[index];
            if (seg && seg.highlight_id) {
                highlightBox(seg.highlight_id);
            }
        }
    }

    // Synthesize Audio via Backend API
    function synthesizeNarrationAudio(text) {
        showLoading('Synthesizing high-clarity neural speech audio...');

        fetch('/api/synthesize-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                voice: 'en-US-AriaNeural',
                rate: `${selectSpeed.value === '1.0' ? '+0%' : selectSpeed.value === '1.5' ? '+25%' : selectSpeed.value === '2.0' ? '+50%' : '-15%'}`
            })
        })
        .then(res => res.json())
        .then(data => {
            hideLoading();
            if (data.status === 'success' && data.audio_url) {
                audioElement.src = data.audio_url;
                audioElement.playbackRate = parseFloat(selectSpeed.value);
                announce('Narration audio ready. Press Space to play.');
            }
        })
        .catch(err => {
            console.error(err);
            hideLoading();
        });
    }

    // Audio Playback Controls
    btnPlayPause.addEventListener('click', toggleAudioPlay);

    function toggleAudioPlay() {
        if (isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
    }

    function playAudio() {
        if (!audioElement.src) return;
        audioElement.play();
        isPlaying = true;
        iconPlay.classList.add('hidden');
        iconPause.classList.remove('hidden');
        btnPlayPause.setAttribute('aria-label', 'Pause Narration Audio');
    }

    function pauseAudio() {
        audioElement.pause();
        isPlaying = false;
        iconPlay.classList.remove('hidden');
        iconPause.classList.add('hidden');
        btnPlayPause.setAttribute('aria-label', 'Play Narration Audio');
    }

    // Audio Time Update Sync
    audioElement.ontimeupdate = () => {
        if (!audioElement.duration) return;

        const current = audioElement.currentTime;
        const total = audioElement.duration;

        seekbar.value = (current / total) * 100;
        timeCurrent.textContent = formatTime(current);
        timeTotal.textContent = formatTime(total);

        // Find matching transcript segment
        for (let i = audioSegments.length - 1; i >= 0; i--) {
            if (current >= audioSegments[i].time_offset) {
                highlightTranscriptSentence(i);
                break;
            }
        }
    };

    audioElement.onended = () => {
        pauseAudio();
        seekbar.value = 0;
    };

    seekbar.addEventListener('input', () => {
        if (audioElement.duration) {
            audioElement.currentTime = (seekbar.value / 100) * audioElement.duration;
        }
    });

    selectSpeed.addEventListener('change', () => {
        const speed = parseFloat(selectSpeed.value);
        audioElement.playbackRate = speed;
        announce(`Playback speed changed to ${speed}x`);
    });

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Navigation Buttons
    btnPrev.addEventListener('click', () => renderSlide(currentSlideIndex - 1));
    btnNext.addEventListener('click', () => renderSlide(currentSlideIndex + 1));

    // Keyboard Shortcuts (WCAG AAA)
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        if (e.code === 'Space') {
            e.preventDefault();
            toggleAudioPlay();
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            renderSlide(currentSlideIndex - 1);
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            renderSlide(currentSlideIndex + 1);
        } else if (e.key.toLowerCase() === 'h') {
            toggleHighContrast();
        } else if (e.key.toLowerCase() === 'd') {
            toggleDyslexiaFont();
        } else if (e.key.toLowerCase() === 'l') {
            toggleLogsPanel();
        }
    });

    // Accessibility Toggles
    btnContrast.addEventListener('click', toggleHighContrast);
    btnDyslexia.addEventListener('click', toggleDyslexiaFont);
    btnLogsToggle.addEventListener('click', toggleLogsPanel);

    function toggleHighContrast() {
        const active = document.body.classList.toggle('theme-high-contrast');
        btnContrast.setAttribute('aria-pressed', active);
        announce(active ? 'High Contrast Mode Enabled' : 'High Contrast Mode Disabled');
    }

    function toggleDyslexiaFont() {
        const active = document.body.classList.toggle('theme-dyslexia');
        btnDyslexia.setAttribute('aria-pressed', active);
        announce(active ? 'Dyslexia Friendly Font Enabled' : 'Dyslexia Friendly Font Disabled');
    }

    function toggleLogsPanel() {
        logsPanel.classList.toggle('hidden');
    }

    btnClearLogs.addEventListener('click', () => {
        logsConsole.innerHTML = '';
    });

    // Export Handlers
    btnDownloadMp3.addEventListener('click', () => {
        if (!audioElement.src) return;
        const a = document.createElement('a');
        a.href = audioElement.src;
        a.download = `slide_${currentSlideIndex + 1}_narration.mp3`;
        a.click();
        announce('Narration MP3 download started.');
    });

    btnDownloadTxt.addEventListener('click', () => {
        if (!currentNarration) return;
        const blob = new Blob([currentNarration.narrative_text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `slide_${currentSlideIndex + 1}_transcript.txt`;
        a.click();
        announce('Transcript export started.');
    });

    // Backend Execution Logs Polling
    function startLogPolling() {
        if (logPollInterval) clearInterval(logPollInterval);
        logPollInterval = setInterval(() => {
            fetch('/api/logs')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.logs) {
                    renderLogs(data.logs);
                }
            })
            .catch(() => {});
        }, 2000);
    }

    function renderLogs(logs) {
        logsConsole.innerHTML = '';
        logs.forEach(log => {
            const div = document.createElement('div');
            let cls = 'info';
            if (log.level === 'SUCCESS') cls = 'success';
            if (log.level === 'ERROR') cls = 'error';
            if (log.component === 'DETECTOR') cls = 'detector';

            div.className = `log-line ${cls}`;
            div.textContent = `[${log.timestamp}] [${log.component}] [${log.level}] ${log.message}`;
            logsConsole.appendChild(div);
        });
        logsConsole.scrollTop = logsConsole.scrollHeight;
    }

    // UI Loading Helpers
    function showLoading(msg) {
        loadingText.textContent = msg || 'Processing...';
        loadingSpinner.classList.remove('hidden');
    }

    function hideLoading() {
        loadingSpinner.classList.add('hidden');
    }
});
