import os
import io
import asyncio
import logging
from gtts import gTTS

AUDIO_CACHE_DIR = os.path.join(os.path.dirname(__file__), "static", "audio")

class TTSSynthesizer:
    def __init__(self):
        os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)

    def synthesize(self, text, voice="en-US-AriaNeural", rate="+0%"):
        # Unique audio filename hash based on text content & voice parameters
        audio_id = f"tts_{hash(text + voice + rate) & 0xffffffff}.mp3"
        file_path = os.path.join(AUDIO_CACHE_DIR, audio_id)
        rel_url = f"/static/audio/{audio_id}"

        if os.path.exists(file_path):
            return rel_url, "Cached Neural Audio"

        # Try edge-tts first
        try:
            success = self._run_edge_tts(text, voice, rate, file_path)
            if success:
                return rel_url, f"edge-tts ({voice})"
        except Exception as e:
            logging.warning(f"edge-tts generation failed: {e}. Falling back to gTTS.")

        # Fallback to gTTS
        try:
            tts = gTTS(text=text, lang='en', slow=False)
            tts.save(file_path)
            return rel_url, "gTTS (Google TTS Engine)"
        except Exception as e:
            logging.error(f"gTTS generation failed: {e}")
            return None, "Browser WebSpeech API (Local Fallback)"

    def _run_edge_tts(self, text, voice, rate, output_path):
        import edge_tts
        async def _generate():
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            await communicate.save(output_path)

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If already in event loop, create task or new loop in thread
                import threading
                def thread_func():
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    new_loop.run_until_complete(_generate())
                    new_loop.close()
                t = threading.Thread(target=thread_func)
                t.start()
                t.join(timeout=10)
            else:
                loop.run_until_complete(_generate())
            return os.path.exists(output_path) and os.path.getsize(output_path) > 0
        except Exception as ex:
            # Try simple asyncio.run
            try:
                asyncio.run(_generate())
                return os.path.exists(output_path) and os.path.getsize(output_path) > 0
            except Exception:
                return False
