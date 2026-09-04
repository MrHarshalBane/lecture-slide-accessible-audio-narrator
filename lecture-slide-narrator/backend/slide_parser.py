import os
import io
import base64
import fitz  # PyMuPDF
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from PIL import Image, ImageDraw, ImageFont

STATIC_SLIDE_DIR = os.path.join(os.path.dirname(__file__), "static", "slides")

class SlideParser:
    def __init__(self):
        os.makedirs(STATIC_SLIDE_DIR, exist_ok=True)

    def parse_file(self, file_path):
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pptx":
            return self._parse_pptx(file_path)
        elif ext == ".pdf":
            return self._parse_pdf(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    def _parse_pptx(self, file_path):
        prs = Presentation(file_path)
        slides_data = []

        slide_width = prs.slide_width.inches if prs.slide_width else 10.0
        slide_height = prs.slide_height.inches if prs.slide_height else 5.625

        for index, slide in enumerate(prs.slides):
            slide_id = f"slide_{index + 1}"
            shapes_list = []
            texts = []
            title = ""

            for shape in slide.shapes:
                shape_type = shape.shape_type
                shape_text = ""
                if shape.has_text_frame:
                    shape_text = shape.text_frame.text.strip()
                    if shape_text:
                        texts.append(shape_text)

                if shape == slide.shapes.title or (shape.has_text_frame and shape == slide.shapes[0] and not title):
                    if shape_text:
                        title = shape_text

                # Bounding box in percentage
                x_pct = (shape.left.inches / slide_width) * 100 if shape.left else 0
                y_pct = (shape.top.inches / slide_height) * 100 if shape.top else 0
                w_pct = (shape.width.inches / slide_width) * 100 if shape.width else 0
                h_pct = (shape.height.inches / slide_height) * 100 if shape.height else 0

                # Color extraction
                color_hex = "#3b82f6"
                try:
                    if hasattr(shape, "fill") and shape.fill.type == 1: # solid fill
                        rgb = shape.fill.fore_color.rgb
                        color_hex = f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"
                except Exception:
                    pass

                shape_data = {
                    "id": f"elem_{len(shapes_list) + 1}",
                    "name": shape.name,
                    "text": shape_text,
                    "type": str(shape_type),
                    "bbox": {
                        "x": round(x_pct, 2),
                        "y": round(y_pct, 2),
                        "w": round(w_pct, 2),
                        "h": round(h_pct, 2)
                    },
                    "color": color_hex
                }
                shapes_list.append(shape_data)

            # Render Synthetic High-Res Image for visual canvas rendering
            img_rel_path, base64_img = self._render_pptx_canvas(slide_id, slide_width, slide_height, shapes_list, title)

            slides_data.append({
                "slide_index": index + 1,
                "title": title or f"Slide {index + 1}",
                "text_content": "\n".join(texts),
                "shapes": shapes_list,
                "image_url": img_rel_path,
                "image_base64": base64_img
            })

        return slides_data

    def _render_pptx_canvas(self, slide_id, width_in, height_in, shapes, title):
        # Render high quality 1280x720 canvas
        canvas_w, canvas_h = 1280, 720
        img = Image.new("RGB", (canvas_w, canvas_h), color=(248, 250, 252))
        draw = ImageDraw.Draw(img)

        # Draw subtle grid/background card
        draw.rectangle([20, 20, canvas_w - 20, canvas_h - 20], fill=(255, 255, 255), outline=(226, 232, 240), width=2)

        for s in shapes:
            bbox = s["bbox"]
            x1 = int((bbox["x"] / 100) * canvas_w)
            y1 = int((bbox["y"] / 100) * canvas_h)
            w = int((bbox["w"] / 100) * canvas_w)
            h = int((bbox["h"] / 100) * canvas_h)
            x2, y2 = x1 + w, y1 + h

            text = s["text"]
            if not text:
                continue

            # Draw shape box
            color = s["color"] if s["color"].startswith("#") else "#3b82f6"
            # Convert hex color to RGB tuple
            try:
                rgb_fill = tuple(int(color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
            except Exception:
                rgb_fill = (59, 130, 246)

            # Draw box rounded
            draw.rectangle([x1, y1, x2, y2], fill=rgb_fill, outline=(30, 41, 59), width=2)

            # Draw text inside
            lines = text.split("\n")
            line_y = y1 + max(5, (h - (len(lines) * 20)) // 2)
            for line in lines:
                draw.text((x1 + 10, line_y), line[:35], fill=(255, 255, 255) if sum(rgb_fill) < 500 else (15, 23, 42))
                line_y += 22

        img_filename = f"{slide_id}_{os.getpid()}.png"
        img_path = os.path.join(STATIC_SLIDE_DIR, img_filename)
        img.save(img_path, format="PNG")

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        b64_str = f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode('utf-8')}"

        return f"/static/slides/{img_filename}", b64_str

    def _parse_pdf(self, file_path):
        doc = fitz.open(file_path)
        slides_data = []

        for index, page in enumerate(doc):
            slide_id = f"pdf_slide_{index + 1}"
            rect = page.rect
            width, height = rect.width, rect.height

            # Extract text blocks
            text_blocks = page.get_text("blocks")
            shapes_list = []
            full_text = []

            title = ""
            for b_idx, block in enumerate(text_blocks):
                x0, y0, x1, y1, text, block_no, block_type = block
                text_clean = text.strip()
                if not text_clean:
                    continue

                full_text.append(text_clean)
                if not title:
                    title = text_clean.split("\n")[0]

                x_pct = (x0 / width) * 100
                y_pct = (y0 / height) * 100
                w_pct = ((x1 - x0) / width) * 100
                h_pct = ((y1 - y0) / height) * 100

                shapes_list.append({
                    "id": f"elem_{b_idx + 1}",
                    "name": f"Text Block {b_idx + 1}",
                    "text": text_clean,
                    "type": "PDF_TEXT_BLOCK",
                    "bbox": {
                        "x": round(x_pct, 2),
                        "y": round(y_pct, 2),
                        "w": round(w_pct, 2),
                        "h": round(h_pct, 2)
                    },
                    "color": "#1e293b"
                })

            # Render actual PDF slide page to high-res PNG image
            pix = page.get_pixmap(dpi=150)
            img_filename = f"{slide_id}_{os.getpid()}.png"
            img_path = os.path.join(STATIC_SLIDE_DIR, img_filename)
            pix.save(img_path)

            img_bytes = pix.tobytes("png")
            b64_str = f"data:image/png;base64,{base64.b64encode(img_bytes).decode('utf-8')}"

            slides_data.append({
                "slide_index": index + 1,
                "title": title[:60] if title else f"Slide {index + 1}",
                "text_content": "\n".join(full_text),
                "shapes": shapes_list,
                "image_url": f"/static/slides/{img_filename}",
                "image_base64": b64_str
            })

        doc.close()
        return slides_data
