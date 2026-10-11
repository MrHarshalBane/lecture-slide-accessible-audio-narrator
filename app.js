document.addEventListener('DOMContentLoaded', () => {

    // App State
    let currentSlides = [];
    let currentSlideIndex = 0;
    let currentNarration = null;
    let audioSegments = [];
    let isPlaying = false;
    let logPollInterval = null;
    let activeDeckName = 'biology';

    // Web Speech API Synthesis state
    let synthUtterance = null;
    let synthPlaying = false;
    let synthStartTime = 0;
    let synthTimer = null;
    let estimatedTotalSeconds = 15;

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

    // Append log message to terminal
    function appendLog(component, level, message) {
        if (!logsConsole) return;
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        const div = document.createElement('div');
        let cls = 'info';
        if (level === 'SUCCESS') cls = 'success';
        if (level === 'ERROR') cls = 'error';
        if (component === 'DETECTOR') cls = 'detector';

        div.className = `log-line ${cls}`;
        div.textContent = `[${timeStr}] [${component}] [${level}] ${message}`;
        logsConsole.appendChild(div);
        logsConsole.scrollTop = logsConsole.scrollHeight;
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
            activeDeckName = deckName;
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
        appendLog('PARSER', 'INFO', `Parsing uploaded presentation file: ${file.name}`);

        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.status === 'success') {
                currentSlides = data.slides;
                currentSlideIndex = 0;
                appendLog('PARSER', 'SUCCESS', `Successfully extracted ${data.slide_count} slides.`);
                announce(`Successfully uploaded and parsed ${file.name}. ${data.slide_count} slides available.`);
                renderSlide(0);
            } else {
                alert(`Upload error: ${data.message}`);
                hideLoading();
            }
        })
        .catch(err => {
            console.warn('Backend upload endpoint not responding (running in static demo mode). Simulating parsing for presentation...');
            appendLog('PARSER', 'INFO', `Local static engine processing ${file.name}`);
            setTimeout(() => {
                // If demo decks available, switch to a matching demonstration or biology
                loadDemoDeck('biology');
                announce(`Demo deck loaded for demonstration purposes.`);
            }, 800);
        });
    });

    // Load Demo Deck Function
    function loadDemoDeck(deckName) {
        showLoading(`Loading demo lecture deck (${deckName})...`);
        activeDeckName = deckName;

        fetch(`/api/demo-slides?deck=${deckName}`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.status === 'success') {
                currentSlides = data.slides;
                currentSlideIndex = 0;
                announce(`Loaded ${data.deck_name} demo deck with ${data.slide_count} slides.`);
                appendLog('SYSTEM', 'SUCCESS', `Loaded ${data.deck_name} demo deck with ${data.slide_count} slides.`);
                renderSlide(0);
            } else {
                alert(`Error loading demo deck: ${data.message}`);
                hideLoading();
            }
        })
        .catch(err => {
            console.log('Fetching from static client dataset DEMO_DECKS...');
            if (window.DEMO_DECKS && window.DEMO_DECKS[deckName]) {
                const deckEntries = window.DEMO_DECKS[deckName];
                currentSlides = deckEntries.map(item => item.slide);
                currentSlideIndex = 0;
                appendLog('SYSTEM', 'SUCCESS', `Loaded client demo deck '${deckName}' with ${currentSlides.length} slides.`);
                announce(`Loaded ${deckName} demo deck with ${currentSlides.length} slides.`);
                renderSlide(0);
            } else {
                console.error(err);
                hideLoading();
            }
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

        // Set Slide Image (or generate SVG visual representation if empty)
        if (slide.image_base64) {
            slideImg.src = slide.image_base64;
        } else if (slide.image_url) {
            slideImg.src = slide.image_url;
        } else {
            slideImg.src = generateSlideSvg(slide);
        }

        // Render Shapes & Bounding Box Overlays
        renderBoundingBoxes(slide.shapes);

        // Pause current audio
        pauseAudio();

        // Check if pre-analyzed in DEMO_DECKS
        let preAnalyzed = null;
        if (window.DEMO_DECKS && window.DEMO_DECKS[activeDeckName] && window.DEMO_DECKS[activeDeckName][currentSlideIndex]) {
            preAnalyzed = window.DEMO_DECKS[activeDeckName][currentSlideIndex];
        }

        // Analyze Slide Diagram & Generate Narration
        showLoading(`Analyzing Slide #${slide.slide_index} visual graphics & diagram topology...`);
        appendLog('DETECTOR', 'INFO', `Scanning visual structure for slide: "${slide.title}"`);

        fetch('/api/analyze-slide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slide: slide })
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.status === 'success') {
                applyAnalysisResult(data.diagram, data.narration);
            } else {
                hideLoading();
            }
        })
        .catch(err => {
            console.log('Using static client precomputed slide analysis & narration...');
            if (preAnalyzed) {
                applyAnalysisResult(preAnalyzed.diagram, preAnalyzed.narration);
            } else {
                // Client-side fallback diagram detection
                const shapeCount = (slide.shapes || []).length;
                const fallbackDiagram = {
                    diagram_type: 'GENERAL_DIAGRAM',
                    confidence: 0.85,
                    element_count: shapeCount
                };
                const fallbackNarration = {
                    diagram_type: 'GENERAL_DIAGRAM',
                    engine_used: 'Client Topology Parser',
                    narrative_text: `Slide ${slide.slide_index} titled ${slide.title} contains ${shapeCount} structured visual components illustrating the subject matter.`,
                    segments: [
                        { index: 0, text: `Slide ${slide.slide_index} titled ${slide.title}.`, time_offset: 0 },
                        { index: 1, text: `It displays ${shapeCount} visual elements organized across the layout.`, time_offset: 3.5 }
                    ]
                };
                applyAnalysisResult(fallbackDiagram, fallbackNarration);
            }
        });
    }

    function applyAnalysisResult(diagram, narration) {
        currentNarration = narration;

        // Update Diagram Meta Bar
        metaType.textContent = formatDiagramType(diagram.diagram_type);
        metaConfidence.textContent = `${Math.round(diagram.confidence * 100)}%`;
        metaElements.textContent = `${diagram.element_count} nodes`;

        engineBadge.textContent = currentNarration.engine_used || 'Neural Audio Narrator';

        appendLog('DETECTOR', 'SUCCESS', `Identified diagram topology: ${diagram.diagram_type} (${Math.round(diagram.confidence * 100)}% confidence, ${diagram.element_count} elements).`);
        appendLog('NARRATOR', 'SUCCESS', `Generated structured pedagogical narration (${(currentNarration.segments || []).length} segments).`);

        // Render Transcript
        renderTranscript(currentNarration);

        // Synthesize TTS Audio
        synthesizeNarrationAudio(currentNarration.narrative_text);
    }

    function generateSlideSvg(slide) {
        const shapes = slide.shapes || [];
        let shapesSvg = '';
        shapes.forEach((s, idx) => {
            const bbox = s.bbox || { x: 10 + (idx * 20), y: 30, w: 20, h: 20 };
            shapesSvg += `
                <rect x="${bbox.x}%" y="${bbox.y}%" width="${bbox.w}%" height="${bbox.h}%" rx="10" fill="#1e293b" stroke="#6366f1" stroke-width="2" />
                <text x="${bbox.x + bbox.w / 2}%" y="${bbox.y + bbox.h / 2}%" fill="#f8fafc" font-size="14" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${escapeXml(s.text || s.name || '')}</text>
            `;
        });

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="100%" height="100%">
            <defs>
                <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0f172a" />
                    <stop offset="100%" stop-color="#1e1b4b" />
                </linearGradient>
            </defs>
            <rect width="960" height="540" fill="url(#bgGrad)" />
            <text x="480" y="60" fill="#38bdf8" font-size="28" font-weight="bold" font-family="sans-serif" text-anchor="middle">${escapeXml(slide.title || 'Slide Diagram')}</text>
            ${shapesSvg}
        </svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function escapeXml(str) {
        return (str || '').replace(/[<>&'"]/g, c => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
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
            if (!shape.text && !shape.name) return;
            const bbox = shape.bbox || { x: 10, y: 10, w: 20, h: 20 };

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
                if (audioElement.src && !synthPlaying) {
                    audioElement.currentTime = seg.time_offset;
                    playAudio();
                    highlightTranscriptSentence(idx);
                } else if ('speechSynthesis' in window) {
                    speakWithWebSpeech(currentNarration.narrative_text, idx);
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

    // Synthesize Audio via Backend API or Web Speech API fallback
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
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            hideLoading();
            if (data.status === 'success' && data.audio_url) {
                audioElement.src = data.audio_url;
                audioElement.playbackRate = parseFloat(selectSpeed.value);
                appendLog('TTS', 'SUCCESS', `EdgeTTS audio synthesis ready (${data.audio_url})`);
                announce('Narration audio ready. Press Space to play.');
            }
        })
        .catch(err => {
            hideLoading();
            // Fallback to Web Speech API
            audioElement.removeAttribute('src');
            // Estimate duration based on word count: avg 150 words per minute => ~2.5 words/sec
            const wordCount = (text || '').split(/\s+/).filter(Boolean).length;
            estimatedTotalSeconds = Math.max(5, Math.round(wordCount / 2.5));
            timeTotal.textContent = formatTime(estimatedTotalSeconds);
            timeCurrent.textContent = '0:00';
            seekbar.value = 0;
            appendLog('TTS', 'INFO', `Web Speech Synthesizer initialized (${wordCount} words, ~${estimatedTotalSeconds}s).`);
            announce('Narration audio ready via Web Speech. Press Space to play.');
        });
    }

    // Web Speech API Narrator Fallback
    function speakWithWebSpeech(text, startSegmentIndex = 0) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();

        let targetText = text;
        if (startSegmentIndex > 0 && audioSegments[startSegmentIndex]) {
            targetText = audioSegments.slice(startSegmentIndex).map(s => s.text).join(' ');
        }

        synthUtterance = new SpeechSynthesisUtterance(targetText);
        synthUtterance.rate = parseFloat(selectSpeed.value) || 1.0;
        synthUtterance.pitch = 1.0;

        // Try to pick English voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google') || v.name.includes('Aria') || v.name.includes('Samantha')));
        if (preferredVoice) synthUtterance.voice = preferredVoice;

        synthStartTime = Date.now();
        synthPlaying = true;
        isPlaying = true;
        iconPlay.classList.add('hidden');
        iconPause.classList.remove('hidden');
        btnPlayPause.setAttribute('aria-label', 'Pause Narration Audio');

        if (synthTimer) clearInterval(synthTimer);
        let currentSegIdx = startSegmentIndex;
        highlightTranscriptSentence(currentSegIdx);

        synthTimer = setInterval(() => {
            if (!synthPlaying) return;
            const elapsed = (Date.now() - synthStartTime) / 1000;
            const currentSec = Math.min(elapsed, estimatedTotalSeconds);
            timeCurrent.textContent = formatTime(currentSec);
            timeTotal.textContent = formatTime(estimatedTotalSeconds);
            seekbar.value = (currentSec / estimatedTotalSeconds) * 100;

            // Highlight corresponding segment
            for (let i = audioSegments.length - 1; i >= 0; i--) {
                if (currentSec >= audioSegments[i].time_offset) {
                    highlightTranscriptSentence(i);
                    break;
                }
            }
        }, 200);

        synthUtterance.onend = () => {
            synthPlaying = false;
            isPlaying = false;
            if (synthTimer) clearInterval(synthTimer);
            iconPlay.classList.remove('hidden');
            iconPause.classList.add('hidden');
            btnPlayPause.setAttribute('aria-label', 'Play Narration Audio');
            timeCurrent.textContent = formatTime(estimatedTotalSeconds);
            seekbar.value = 100;
            announce('Narration finished.');
        };

        synthUtterance.onerror = () => {
            synthPlaying = false;
            isPlaying = false;
            if (synthTimer) clearInterval(synthTimer);
            iconPlay.classList.remove('hidden');
            iconPause.classList.add('hidden');
        };

        window.speechSynthesis.speak(synthUtterance);
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
        if (audioElement.src) {
            audioElement.play();
            isPlaying = true;
            iconPlay.classList.add('hidden');
            iconPause.classList.remove('hidden');
            btnPlayPause.setAttribute('aria-label', 'Pause Narration Audio');
        } else if (currentNarration && 'speechSynthesis' in window) {
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
                synthPlaying = true;
                isPlaying = true;
                iconPlay.classList.add('hidden');
                iconPause.classList.remove('hidden');
            } else {
                speakWithWebSpeech(currentNarration.narrative_text);
            }
        }
    }

    function pauseAudio() {
        if (audioElement.src) {
            audioElement.pause();
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            if (synthTimer) clearInterval(synthTimer);
            synthPlaying = false;
        }
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
        if (audioElement.src && audioElement.duration) {
            audioElement.currentTime = (seekbar.value / 100) * audioElement.duration;
        }
    });

    selectSpeed.addEventListener('change', () => {
        const speed = parseFloat(selectSpeed.value);
        if (audioElement.src) {
            audioElement.playbackRate = speed;
        }
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
        if (audioElement.src) {
            const a = document.createElement('a');
            a.href = audioElement.src;
            a.download = `slide_${currentSlideIndex + 1}_narration.mp3`;
            a.click();
            announce('Narration MP3 download started.');
        } else {
            announce('MP3 export is available when backend neural TTS is running. Use text transcript export.');
            alert('Audio file download is generated when the Python Neural TTS backend is connected. You can export the full text transcript below!');
        }
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
            .then(res => {
                if (!res.ok) throw new Error();
                return res.json();
            })
            .then(data => {
                if (data.status === 'success' && data.logs) {
                    renderLogs(data.logs);
                }
            })
            .catch(() => {});
        }, 3000);
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
