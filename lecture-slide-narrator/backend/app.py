import os
import sys
import json
import time
import logging
from flask import Flask, request, jsonify, send_from_directory

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from slide_parser import SlideParser
from diagram_detector import DiagramDetector
from narration_engine import NarrationEngine
from tts_synthesizer import TTSSynthesizer
from sample_generator import create_sample_decks

# Initialize Flask app
app = Flask(__name__, static_folder="../frontend", static_url_path="")
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 # 50 MB max upload limit

# In-memory execution logs for live terminal traces panel
EXECUTION_LOGS = []

def log_trace(level, message, component="BACKEND"):
    timestamp = time.strftime("%H:%M:%S")
    log_entry = {
        "timestamp": timestamp,
        "level": level,
        "component": component,
        "message": message
    }
    EXECUTION_LOGS.append(log_entry)
    if len(EXECUTION_LOGS) > 200:
        EXECUTION_LOGS.pop(0)
    print(f"[{timestamp}] [{level}] [{component}] {message}")

# Initialize components
parser = SlideParser()
detector = DiagramDetector()
narrator = NarrationEngine()
synthesizer = TTSSynthesizer()

# Ensure sample decks exist
create_sample_decks()
log_trace("INFO", "AuraSlide Narrator Backend initialized. Sample slide decks ready.", "SYSTEM")

# Direct routes
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/static/slides/<path:filename>')
def serve_slides(filename):
    slide_dir = os.path.join(os.path.dirname(__file__), "static", "slides")
    return send_from_directory(slide_dir, filename)

@app.route('/static/audio/<path:filename>')
def serve_audio(filename):
    audio_dir = os.path.join(os.path.dirname(__file__), "static", "audio")
    return send_from_directory(audio_dir, filename)

# API Endpoints
@app.route('/api/demo-slides', methods=['GET'])
def get_demo_slides():
    deck_key = request.args.get('deck', 'biology')
    sample_files = create_sample_decks()
    file_path = sample_files.get(deck_key, sample_files['biology'])

    log_trace("INFO", f"Loading demo slide deck: {deck_key} ({os.path.basename(file_path)})", "PARSER")
    
    try:
        slides = parser.parse_file(file_path)
        log_trace("SUCCESS", f"Parsed {len(slides)} slides from {deck_key} deck.", "PARSER")
        return jsonify({
            "status": "success",
            "deck_name": deck_key,
            "filename": os.path.basename(file_path),
            "slide_count": len(slides),
            "slides": slides
        })
    except Exception as e:
        log_trace("ERROR", f"Failed to parse demo slide deck: {str(e)}", "PARSER")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "Empty filename"}), 400

    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ['.pptx', '.pdf']:
        return jsonify({"status": "error", "message": "Only PPTX and PDF files are supported."}), 400

    upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    save_path = os.path.join(upload_dir, filename)
    file.save(save_path)

    log_trace("INFO", f"Uploaded slide file: {filename} ({os.path.getsize(save_path)} bytes)", "UPLOADER")

    try:
        slides = parser.parse_file(save_path)
        log_trace("SUCCESS", f"Successfully extracted {len(slides)} slides from {filename}.", "PARSER")
        return jsonify({
            "status": "success",
            "filename": filename,
            "slide_count": len(slides),
            "slides": slides
        })
    except Exception as e:
        log_trace("ERROR", f"Error parsing uploaded file: {str(e)}", "PARSER")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/analyze-slide', methods=['POST'])
def analyze_slide():
    data = request.json or {}
    slide = data.get("slide", {})

    log_trace("INFO", f"Analyzing Slide #{slide.get('slide_index', 1)}: '{slide.get('title', 'Untitled')}'", "DETECTOR")

    # 1. Detect diagram structure & graphic topology
    diagram_info = detector.detect_diagram_structure(slide)
    log_trace("INFO", f"Detected Diagram Type: {diagram_info['diagram_type']} (Confidence: {int(diagram_info['confidence']*100)}%)", "DETECTOR")

    # 2. Generate natural pedagogical audio narration script
    narration_result = narrator.generate_narration(slide, diagram_info)
    log_trace("SUCCESS", f"Generated continuous narration narrative ({len(narration_result['narrative_text'])} chars) via {narration_result['engine_used']}", "NARRATOR")

    return jsonify({
        "status": "success",
        "diagram": diagram_info,
        "narration": narration_result
    })

@app.route('/api/synthesize-audio', methods=['POST'])
def synthesize_audio():
    data = request.json or {}
    text = data.get("text", "")
    voice = data.get("voice", "en-US-AriaNeural")
    rate = data.get("rate", "+0%")

    if not text:
        return jsonify({"status": "error", "message": "No text provided for audio synthesis"}), 400

    log_trace("INFO", f"Synthesizing TTS audio using voice '{voice}' (rate: {rate})...", "TTS")

    audio_url, engine_info = synthesizer.synthesize(text, voice=voice, rate=rate)
    log_trace("SUCCESS", f"TTS Audio synthesized via {engine_info}. URL: {audio_url}", "TTS")

    return jsonify({
        "status": "success",
        "audio_url": audio_url,
        "engine_used": engine_info
    })

@app.route('/api/logs', methods=['GET'])
def get_logs():
    return jsonify({
        "status": "success",
        "logs": EXECUTION_LOGS
    })

if __name__ == '__main__':
    log_trace("INFO", "Starting Flask server on http://127.0.0.1:5000", "SERVER")
    app.run(host='127.0.0.1', port=5000, debug=True)
