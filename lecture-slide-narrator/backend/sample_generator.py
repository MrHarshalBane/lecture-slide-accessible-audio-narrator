import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "sample_decks")

def create_sample_decks():
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    
    # Deck 1: Biology Hierarchy Tree
    bio_path = os.path.join(SAMPLES_DIR, "biology_hierarchy.pptx")
    if not os.path.exists(bio_path):
        prs = Presentation()
        prs.slide_width = Inches(10)
        prs.slide_height = Inches(5.625) # 16:9 widescreen
        
        slide = prs.slides.add_slide(prs.slide_layouts[6]) # blank layout
        
        # Add Title
        tx_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.4), Inches(9), Inches(0.8))
        tf = tx_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = "Evolutionary Tree: Mammalian Classification"
        p.font.size = Pt(28)
        p.font.bold = True
        p.font.color.rgb = RGBColor(15, 23, 42)
        
        # Subtitle
        p2 = tf.add_paragraph()
        p2.text = "Hierarchy tracing Kingdom Animalia down to Canines and Sub-species"
        p2.font.size = Pt(14)
        p2.font.color.rgb = RGBColor(71, 85, 105)

        # Hierarchy Nodes (Boxes)
        # Root Node
        node_root = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.0), Inches(1.3), Inches(2.0), Inches(0.6))
        node_root.fill.solid()
        node_root.fill.fore_color.rgb = RGBColor(30, 58, 138)
        node_root.text_frame.text = "Class: Mammalia"
        node_root.text_frame.paragraphs[0].font.color.rgb = RGBColor(255, 255, 255)
        node_root.text_frame.paragraphs[0].font.bold = True

        # Level 1
        node_l1 = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.0), Inches(2.3), Inches(2.0), Inches(0.6))
        node_l1.fill.solid()
        node_l1.fill.fore_color.rgb = RGBColor(37, 99, 235)
        node_l1.text_frame.text = "Order: Carnivora"
        node_l1.text_frame.paragraphs[0].font.color.rgb = RGBColor(255, 255, 255)

        # Level 2
        node_l2 = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.0), Inches(3.3), Inches(2.0), Inches(0.6))
        node_l2.fill.solid()
        node_l2.fill.fore_color.rgb = RGBColor(14, 165, 233)
        node_l2.text_frame.text = "Family: Canidae"
        node_l2.text_frame.paragraphs[0].font.color.rgb = RGBColor(255, 255, 255)

        # Level 3 (Branches)
        node_wolf = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(2.2), Inches(4.4), Inches(2.2), Inches(0.6))
        node_wolf.fill.solid()
        node_wolf.fill.fore_color.rgb = RGBColor(16, 185, 129)
        node_wolf.text_frame.text = "Canis lupus (Wolf)"
        node_wolf.text_frame.paragraphs[0].font.color.rgb = RGBColor(255, 255, 255)

        node_dog = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(5.6), Inches(4.4), Inches(2.2), Inches(0.6))
        node_dog.fill.solid()
        node_dog.fill.fore_color.rgb = RGBColor(20, 184, 166)
        node_dog.text_frame.text = "Canis familiaris (Dog)"
        node_dog.text_frame.paragraphs[0].font.color.rgb = RGBColor(255, 255, 255)

        prs.save(bio_path)

    # Deck 2: CS Flowchart
    cs_path = os.path.join(SAMPLES_DIR, "cs_binary_search.pptx")
    if not os.path.exists(cs_path):
        prs = Presentation()
        prs.slide_width = Inches(10)
        prs.slide_height = Inches(5.625)
        slide = prs.slides.add_slide(prs.slide_layouts[6])

        tx_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(9), Inches(0.8))
        tf = tx_box.text_frame
        p = tf.paragraphs[0]
        p.text = "Algorithm Process Flow: Binary Search"
        p.font.size = Pt(26)
        p.font.bold = True
        p.font.color.rgb = RGBColor(15, 23, 42)

        # Flowchart shapes
        s1 = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(0.8), Inches(1.5), Inches(1.8), Inches(0.6))
        s1.fill.solid()
        s1.fill.fore_color.rgb = RGBColor(99, 102, 241)
        s1.text_frame.text = "1. Start Search"

        s2 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(3.0), Inches(1.5), Inches(2.2), Inches(0.6))
        s2.fill.solid()
        s2.fill.fore_color.rgb = RGBColor(79, 70, 229)
        s2.text_frame.text = "2. Calculate Mid Index"

        s3 = slide.shapes.add_shape(MSO_SHAPE.DIAMOND, Inches(5.6), Inches(1.2), Inches(2.2), Inches(1.2))
        s3.fill.solid()
        s3.fill.fore_color.rgb = RGBColor(217, 119, 6)
        s3.text_frame.text = "Target == Mid?"

        s4_yes = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.0), Inches(1.5), Inches(1.6), Inches(0.6))
        s4_yes.fill.solid()
        s4_yes.fill.fore_color.rgb = RGBColor(22, 163, 74)
        s4_yes.text_frame.text = "Return Index"

        s4_left = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(4.2), Inches(3.2), Inches(2.4), Inches(0.6))
        s4_left.fill.solid()
        s4_left.fill.fore_color.rgb = RGBColor(37, 99, 235)
        s4_left.text_frame.text = "Target < Mid: Search Left"

        s4_right = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(7.0), Inches(3.2), Inches(2.4), Inches(0.6))
        s4_right.fill.solid()
        s4_right.fill.fore_color.rgb = RGBColor(147, 51, 234)
        s4_right.text_frame.text = "Target > Mid: Search Right"

        prs.save(cs_path)

    # Deck 3: Business Supply Chain
    biz_path = os.path.join(SAMPLES_DIR, "business_process.pptx")
    if not os.path.exists(biz_path):
        prs = Presentation()
        prs.slide_width = Inches(10)
        prs.slide_height = Inches(5.625)
        slide = prs.slides.add_slide(prs.slide_layouts[6])

        tx_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.4), Inches(9), Inches(0.8))
        tf = tx_box.text_frame
        p = tf.paragraphs[0]
        p.text = "Supply Chain Lifecycle: E-Commerce Order Fulfillment"
        p.font.size = Pt(26)
        p.font.bold = True

        steps = [
            ("Step 1", "Order Received", RGBColor(14, 116, 144)),
            ("Step 2", "Warehouse Verification", RGBColor(3, 105, 161)),
            ("Step 3", "Automated Packaging", RGBColor(29, 78, 216)),
            ("Step 4", "Courier Dispatch", RGBColor(109, 40, 217)),
            ("Step 5", "Final Delivery", RGBColor(4, 120, 87))
        ]

        left_pos = 0.5
        for index, (step_num, title, color) in enumerate(steps):
            box = slide.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(left_pos), Inches(2.2), Inches(1.7), Inches(1.0))
            box.fill.solid()
            box.fill.fore_color.rgb = color
            box.text_frame.text = f"{step_num}\n{title}"
            left_pos += 1.85

        prs.save(biz_path)

    return {
        "biology": bio_path,
        "cs": cs_path,
        "business": biz_path
    }

if __name__ == "__main__":
    create_sample_decks()
    print("Sample decks successfully generated.")
