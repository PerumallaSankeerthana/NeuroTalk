import torch
import os
from transformers import DistilBertForSequenceClassification, DistilBertTokenizerFast

# Load the model and tokenizer from saved_model
MODEL_REPO = "sankeerthanareddy/neurotalk-emotion-model"

tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_REPO)

model = DistilBertForSequenceClassification.from_pretrained(
    MODEL_REPO,
    attn_implementation="eager"
)
model.eval()

def explain_prediction(text):
    text = text.lower()
    
    inputs = tokenizer(
        text,
        truncation=True,
        max_length=128,
        return_tensors="pt"
    )
    
    with torch.no_grad():
        outputs = model(
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"],
            output_attentions=True
        )
        
    attentions = outputs.attentions[-1]
    avg_attention = torch.mean(attentions, dim=1).squeeze(0)
    importance_scores = torch.sum(avg_attention, dim=0)
    
    min_score = torch.min(importance_scores)
    max_score = torch.max(importance_scores)
    
    if max_score > min_score:
        normalized_scores = (importance_scores - min_score) / (max_score - min_score)
    else:
        normalized_scores = torch.zeros_like(importance_scores)
        
    tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
    scores_list = normalized_scores.tolist()
    
    merged_scores = {}
    current_word = ""
    current_score = 0.0
    
    for token, score in zip(tokens, scores_list):
        if token in ["[CLS]", "[SEP]"]:
            if current_word:
                merged_scores[current_word] = merged_scores.get(current_word, 0) + current_score
                current_word = ""
                current_score = 0.0
            continue
            
        if token.startswith("##"):
            current_word += token[2:]
            current_score += score
        else:
            if current_word:
                merged_scores[current_word] = merged_scores.get(current_word, 0) + current_score
            current_word = token
            current_score = score
            
    if current_word:
        merged_scores[current_word] = merged_scores.get(current_word, 0) + current_score
    if not merged_scores:
        return []  
    sorted_words = sorted(merged_scores.items(), key=lambda x: x[1], reverse=True)
    k = min(5, len(sorted_words))
    top_5 = [{"word": word, "score": round(score, 4)} for word, score in sorted_words[:k]]
    
    return top_5

def predict_emotion(text):

    # Minimal preprocessing
    text = text.lower()
    
    # Tokenize
    inputs = tokenizer(
        text,
        truncation=True,
        max_length=128,
        return_tensors="pt"
    )
    
    # Pass input_ids and attention_mask to the model
    with torch.no_grad():
        outputs = model(
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"]
        )
        
    # Apply softmax on the raw logits along dim=1
    logits = outputs.logits
    probs = torch.nn.functional.softmax(logits, dim=1)
    
    # Get top 3 scores and their indices
    scores, indices = torch.topk(probs, 3, dim=1)
    
    scores = scores[0].tolist()
    indices = indices[0].tolist()
    
    # Map indices to labels
    top_3 = []
    for score, idx in zip(scores, indices):
        label = model.config.id2label[idx]
        top_3.append({
            "label": label,
            "score": score
        })

    top_label = top_3[0]["label"]
    confidence = round(top_3[0]["score"], 4)
    highlight_words = explain_prediction(text)
    
    return top_label, confidence, top_3, highlight_words

if __name__ == "__main__":
    test_text = "I am feeling quite overwhelmed with everything lately."
    top_label, confidence, top_3, highlight_words = predict_emotion(test_text)
    print(f"Test text: '{test_text}'")
    print(f"Top emotion: {top_label} (Confidence: {confidence})")
    print("Top 3 emotions:")
    for item in top_3:
        print(f" - {item['label']}: {item['score']:.4f}")