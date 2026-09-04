import os
import sys
import webbrowser
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app import app, log_trace

def main():
    print("=" * 60)
    print("  AuraSlide Narrator - Lecture Slides to Accessible Audio")
    print("  EdTech Accessibility Platform (PS 03)")
    print("=" * 60)
    print("Starting backend API server at http://127.0.0.1:5000 ...")

    # Automatically open browser window after 1.5 seconds
    def open_browser():
        time.sleep(1.5)
        webbrowser.open("http://127.0.0.1:5000")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    app.run(host="127.0.0.1", port=5000, debug=False)

if __name__ == "__main__":
    main()
