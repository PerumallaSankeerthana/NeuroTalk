import os
import sys
import random
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

current_dir = os.path.dirname(os.path.abspath(__file__))
ml_dir = os.path.abspath(os.path.join(current_dir, '..', 'ml'))
if ml_dir not in sys.path:
    sys.path.append(ml_dir)

from model import predict_emotion
#from cognitive import detect_cognitive_distortions

chat_bp = Blueprint('chat', __name__)

# ── RESPONSE POOLS ──────────────────────────────────────────────

RESPONSE_POOLS = {
    "sadness": [
        "It sounds like you're carrying something heavy right now. What's been weighing on you the most?",
        "I hear you. Sometimes just putting feelings into words is the first step. What brought this on?",
        "That sounds really difficult. You don't have to have it all figured out — what would feel like a small relief right now?",
        "It's okay to feel this way. When did you first start feeling like this?",
        "I'm here with you. What part of this feels hardest to sit with?",
        "Sometimes sadness is telling us something important. What do you think yours might be pointing to?",
    ],
    "fear": [
        "That sounds really unsettling. What feels most uncertain to you right now?",
        "Fear often shows up when something matters deeply to us. What are you most afraid of losing or facing?",
        "It's okay to feel scared. Can you tell me more about what's triggering this?",
        "When fear shows up this strongly, grounding can help. What's one thing you can see, hear, or feel right now?",
        "What would it look like if things went better than you're currently expecting?",
        "You're not alone in this. What's the worst part of what you're imagining?",
    ],
    "joy": [
        "That's wonderful to hear! What's been making things feel good lately?",
        "I love that energy. What happened that's got you feeling this way?",
        "It's great that you're in a positive space. What do you want to do with this feeling?",
        "Moments like these are worth noticing. What made today different?",
        "That positivity is contagious! Is there something specific you're proud of right now?",
        "Hold onto that feeling. What's been going right for you?",
    ],
    "anger": [
        "It sounds like something really got to you. What happened?",
        "That frustration makes sense. What do you wish had gone differently?",
        "Anger often points to something that felt unfair. What crossed a line for you?",
        "I hear that you're fired up. What do you need right now?",
        "Sometimes anger protects something underneath. What do you think is really hurting here?",
        "That sounds genuinely frustrating. What would resolution look like to you?",
    ],
    "love": [
        "That warmth comes through clearly. What or who are you thinking about?",
        "It's beautiful when we feel connected like that. What's bringing up these feelings?",
        "Love and care are powerful. How is this feeling sitting with you?",
        "That sounds like something meaningful. What does this person or thing mean to you?",
        "Cherish that feeling. What do you want to do with it?",
        "It's good to pause and appreciate what we love. What made you feel this way today?",
    ],
    "surprise": [
        "That sounds unexpected! How are you processing it?",
        "Surprises can be a lot to take in. Was this a good surprise or a difficult one?",
        "Sometimes the unexpected shakes things up in interesting ways. How do you feel about it now?",
        "That caught you off guard it seems. What's going through your mind?",
        "Life throws curveballs. What does this change for you?",
        "Interesting! What part of this surprised you the most?",
    ],
    "neutral": [
        "Thanks for sharing that. What's been on your mind lately?",
        "I'm here to listen. Is there something specific you wanted to explore today?",
        "Sometimes it's hard to put a label on what we're feeling. What's going on for you?",
        "Tell me more — what's been happening in your world?",
        "I'm listening. What brought you here today?",
        "What's something you've been thinking about but haven't said out loud yet?",
    ]
}

DISTORTION_ADDITIONS = {
    "catastrophizing": [
        " I notice you might be imagining the worst outcome — what's a more realistic possibility?",
        " When everything feels like it's falling apart, it helps to ask: what's actually in my control right now?",
        " Our minds sometimes jump to the worst case. What evidence do you have that things will go that badly?",
    ],
    "overgeneralization": [
        " It sounds like this feels like a pattern. Has there been a time recently where things went differently?",
        " Words like 'always' and 'never' can make things feel heavier than they are. Is this really every time?",
        " One difficult experience doesn't define the whole story. What's one exception you can think of?",
    ],
    "black and white thinking": [
        " It sounds like this feels very all-or-nothing. Is there a middle ground you haven't considered?",
        " Things are rarely completely one way or the other. What does the in-between look like here?",
        " What would a 'good enough' outcome look like, even if it's not perfect?",
    ],
    "mind reading": [
        " It's hard when we feel like we know what others think. But have you asked them directly?",
        " We often assume the worst about what others think. What's another way they might see it?",
        " What if their reaction had nothing to do with you?",
    ],
    "fortune telling": [
        " Predicting the future is exhausting. What if things turned out better than you're expecting?",
        " What would you tell a friend who was convinced something bad was definitely going to happen?",
        " The future is uncertain — what's one positive possibility you haven't considered?",
    ],
    "personalization": [
        " It sounds like you're taking a lot of responsibility for this. What role did other factors play?",
        " Not everything that goes wrong is your fault. What else contributed to this situation?",
        " You're being really hard on yourself. What would you say to a friend in this situation?",
    ],
    "emotional reasoning": [
        " Feelings are real, but they don't always reflect facts. What's the evidence outside of how you feel?",
        " Just because it feels true doesn't make it true. What do you know for certain?",
        " Our emotions can distort our perception. What would this look like from the outside?",
    ],
    "filtering": [
        " It sounds like the negatives are taking up all the space. What's one thing that went okay today?",
        " When we filter out the good, everything feels worse. What are you not giving yourself credit for?",
        " What would you notice if you looked for something positive in this situation?",
    ],
}

def generate_fallback_response(emotion, confidence, distortions):
    emotion = emotion.lower()
    pool = RESPONSE_POOLS.get(emotion, RESPONSE_POOLS["neutral"])
    base = random.choice(pool)

    if distortions and len(distortions) > 0:
        top_distortion = (
            distortions[0].get("distortion")
            or distortions[0].get("name","")
            ).lower()
        additions = DISTORTION_ADDITIONS.get(top_distortion, [])
        if additions:
            base = base.rstrip() + random.choice(additions)

    if confidence < 0.55:
        base += " (I want to make sure I understand — how would you describe what you're feeling in your own words?)"

    return base


def generate_gemini_response(system_prompt, conversation_history, user_message):
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        messages = []
        for msg in conversation_history[-10:]:
            messages.append(
                types.Content(
                    role=msg["role"],
                    parts=[types.Part(text=msg["content"])]
                )
            )
        messages.append(
            types.Content(
                role="user",
                parts=[types.Part(text=user_message)]
            )
        )

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=200,
                temperature=0.7
            ),
            contents=messages
        )
        return response.text, False

    except Exception as e:
        print(f"Gemini failed: {e}. Switching to fallback.")
        return None, True


@chat_bp.route('/chat', methods=['POST'])
@jwt_required()
def chat():
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'Message is required'}), 400

    message = data['message']
    conversation_history = data.get('conversation_history', [])

    # Always re-run on every message
    top_label, confidence, top_3,_ = predict_emotion(message)
    distortions = []

    distortion_names = [d.get('distortion', '') for d in distortions] if distortions else []
    distortion_str = ', '.join(distortion_names) if distortion_names else 'none'

    system_prompt = (
        f"You are a compassionate emotional reflection assistant. "
        f"The user's current message has been analyzed: detected emotion is {top_label} "
        f"with {round(confidence * 100, 1)}% confidence. "
        f"Detected cognitive distortions: {distortion_str}. "
        f"Respond in a supportive, reflective, conversational way. "
        f"Ask follow-up questions to encourage reflection. "
        f"Keep responses under 100 words. "
        f"Do not mention emotion detection or distortion analysis directly."
    )

    ai_reply, fallback_used = generate_gemini_response(
        system_prompt, conversation_history, message
    )

    if fallback_used or not ai_reply:
        ai_reply = generate_fallback_response(top_label, confidence, distortions)
        fallback_used = True

    return jsonify({
        'ai_reply': ai_reply,
        'detected_emotion': top_label,
        'confidence': round(confidence, 4),
        'top_3': top_3,
        'cognitive_distortions': distortions,
        'fallback_mode': fallback_used,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }), 200