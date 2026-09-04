import os
import json
import logging

class NarrationEngine:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    def generate_narration(self, slide, diagram_info):
        title = slide.get("title", "Lecture Slide")
        text_raw = slide.get("text_content", "")
        diagram_type = diagram_info.get("diagram_type", "GENERAL_DIAGRAM")
        topology = diagram_info.get("topology", {})

        # Try Gemini multimodal generation if API key is set
        if self.api_key:
            try:
                from google import genai
                client = genai.Client(api_key=self.api_key)
                prompt = f"""
You are an expert accessibility EdTech narrator for visually impaired university students.
Transform the following lecture slide and diagram into a continuous, natural spoken explanation.
DO NOT read raw box labels like "Box 1, Box 2".

Slide Title: {title}
Diagram Type: {diagram_type}
Diagram Topology: {json.dumps(topology)}
Raw Text Content: {text_raw}

Return a continuous, natural narration script suitable for Text-to-Speech audio output.
Structure the narrative with:
1. Overview Hook: What the slide visually presents.
2. Diagram Walkthrough: Natural flow (e.g. tracing hierarchy root to leaves, flowchart steps, or chart trend).
3. Pedagogical Summary: Key takeaway for the student.
"""
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt
                )
                if response and response.text:
                    full_text = response.text.strip()
                    segments = self._build_transcript_segments(full_text, topology)
                    return {
                        "narrative_text": full_text,
                        "segments": segments,
                        "engine_used": "Gemini 2.5 Flash Vision API"
                    }
            except Exception as e:
                logging.warning(f"Gemini API narration fallback to pedagogical rule engine: {e}")

        # Intelligent Pedagogical Local Narrative Builder
        return self._generate_pedagogical_local_narration(title, text_raw, diagram_type, topology)

    def _generate_pedagogical_local_narration(self, title, text_raw, diagram_type, topology):
        segments = []
        full_paragraphs = []

        if diagram_type == "HIERARCHY_TREE":
            levels = topology.get("hierarchy_levels", [])
            root = topology.get("root", {})
            root_text = root.get("text", "the top classification") if root else "the main taxonomy"

            p1 = f"This slide presents an evolutionary tree tracing {root_text} down through its taxonomic hierarchy."
            full_paragraphs.append(p1)
            segments.append({"time_offset": 0.0, "text": p1, "highlight_id": root.get("id") if root else None})

            if len(levels) > 1:
                mid_nodes = [n["text"] for level in levels[1:-1] for n in level["nodes"]]
                mid_str = ", leading to ".join(mid_nodes) if mid_nodes else "sub-categories"
                p2 = f"Beginning at {root_text}, the hierarchy descends to {mid_str}."
                full_paragraphs.append(p2)
                segments.append({"time_offset": 4.5, "text": p2, "highlight_id": levels[1]["nodes"][0]["id"] if len(levels[1]["nodes"]) > 0 else None})

            # Leaf branches
            last_level = levels[-1]["nodes"] if levels else []
            leaf_texts = [n["text"] for n in last_level]
            if len(leaf_texts) >= 2:
                leaf_str = " and ".join(leaf_texts)
                p3 = f"At the terminal level, the structure branches into {leaf_str}."
                full_paragraphs.append(p3)
                segments.append({"time_offset": 9.0, "text": p3, "highlight_id": last_level[0]["id"] if last_level else None})
            elif len(leaf_texts) == 1:
                p3 = f"The terminal leaf node represents {leaf_texts[0]}."
                full_paragraphs.append(p3)
                segments.append({"time_offset": 9.0, "text": p3, "highlight_id": last_level[0]["id"] if last_level else None})

            p_summary = f"In summary, this diagram illustrates how biological organism groups diverge from broad classifications down to specific species."
            full_paragraphs.append(p_summary)
            segments.append({"time_offset": 13.5, "text": p_summary, "highlight_id": None})

        elif diagram_type == "FLOWCHART":
            seq = topology.get("sequence", [])
            steps_texts = [s["text"] for s in seq]

            p1 = f"This slide illustrates an algorithmic flowchart outlining the step-by-step logic for {title}."
            full_paragraphs.append(p1)
            segments.append({"time_offset": 0.0, "text": p1, "highlight_id": seq[0]["id"] if seq else None})

            if len(steps_texts) >= 3:
                p2 = f"The procedure initiates with {steps_texts[0]}. Next, it proceeds to {steps_texts[1]}, where a conditional decision evaluates {steps_texts[2]}."
                full_paragraphs.append(p2)
                segments.append({"time_offset": 4.5, "text": p2, "highlight_id": seq[1]["id"] if len(seq) > 1 else None})

                remaining = ", ".join(steps_texts[3:]) if len(steps_texts) > 3 else "further conditional branches"
                p3 = f"Depending on the evaluation outcome, execution routes to {remaining}."
                full_paragraphs.append(p3)
                segments.append({"time_offset": 10.0, "text": p3, "highlight_id": seq[-1]["id"] if seq else None})
            else:
                p2 = f"The flow executes through the following sequence: {' then '.join(steps_texts)}."
                full_paragraphs.append(p2)
                segments.append({"time_offset": 5.0, "text": p2, "highlight_id": seq[0]["id"] if seq else None})

            p_summary = f"This structured visual walkthrough helps visually impaired students understand the execution logic without reading raw shape boxes."
            full_paragraphs.append(p_summary)
            segments.append({"time_offset": 14.5, "text": p_summary, "highlight_id": None})

        elif diagram_type == "LINEAR_PROCESS":
            stages = topology.get("stages", [])
            stage_texts = [s["text"].replace('\n', ' ') for s in stages]

            p1 = f"This slide depicts a linear process flow tracking {title} across {len(stages)} distinct sequential milestones."
            full_paragraphs.append(p1)
            segments.append({"time_offset": 0.0, "text": p1, "highlight_id": stages[0]["id"] if stages else None})

            for idx, st in enumerate(stages):
                txt = st["text"].replace('\n', ': ')
                p_st = f"Milestone {idx + 1}: {txt}."
                full_paragraphs.append(p_st)
                segments.append({"time_offset": 4.0 + (idx * 3.5), "text": p_st, "highlight_id": st["id"]})

            p_summary = "Each stage flows continuously into the next to ensure seamless operational fulfillment."
            full_paragraphs.append(p_summary)
            segments.append({"time_offset": 4.0 + (len(stages) * 3.5), "text": p_summary, "highlight_id": None})

        else:
            # General slide narrative
            clean_text = " ".join(text_raw.splitlines())
            p1 = f"This slide is titled {title}. It provides key educational concepts on {title}."
            p2 = f"The main text and graphical annotations explain: {clean_text[:250]}..." if len(clean_text) > 250 else f"The visual content explains: {clean_text}."
            p_summary = "Review this narrative to gain full comprehension of the visual concepts presented."

            full_paragraphs = [p1, p2, p_summary]
            segments = [
                {"time_offset": 0.0, "text": p1, "highlight_id": None},
                {"time_offset": 5.0, "text": p2, "highlight_id": None},
                {"time_offset": 11.0, "text": p_summary, "highlight_id": None}
            ]

        full_narrative = " ".join(full_paragraphs)
        return {
            "narrative_text": full_narrative,
            "segments": segments,
            "engine_used": "Pedagogical Visual Structural Engine (Rule-based Fallback)"
        }

    def _build_transcript_segments(self, full_text, topology):
        sentences = [s.strip() for s in full_text.split(".") if s.strip()]
        segments = []
        offset = 0.0
        for idx, s in enumerate(sentences):
            segments.append({
                "time_offset": round(offset, 1),
                "text": s + ".",
                "highlight_id": None
            })
            offset += max(3.0, len(s.split()) * 0.4)
        return segments
