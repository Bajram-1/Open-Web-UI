# Model Routing Configuration

## Overview
The system now supports intelligent model routing based on file attachments. When PDF files are attached to a chat, the system automatically routes to a RAG-capable model. For general questions without PDFs, it uses the default model.

## Configuration

### Environment Variables
Set these in your `docker-compose.yaml` or environment:

```yaml
environment:
  - 'DEFAULT_MODELS=gemma4'           # Model for general questions
  - 'RAG_MODEL=gemma4'                # Model for PDF-related questions
```

### How It Works

1. **General Questions (No PDFs)**
   - Uses the model specified in `DEFAULT_MODELS`
   - Default: `gemma4`
   - Used for: General conversational queries, questions without document attachments

2. **PDF-Related Questions (With PDFs)**
   - Uses the model specified in `RAG_MODEL`
   - Default: `gemma4` (can be configured to a different RAG-optimized model)
   - Used for: Questions when PDF files are attached to the chat
   - The system automatically detects PDF files in the `metadata.files` array

### File Detection Logic
The system checks for PDF files in the attachment metadata:
```python
has_pdf_files = any(
    file.get("type") == "file" and
    (file.get("meta", {}).get("name", "").lower().endswith(".pdf") or
     file.get("filename", "").lower().endswith(".pdf"))
    for file in files
)
```

### Admin Configuration
Administrators can configure these models through the Admin Panel:
1. Go to **Settings > Models**
2. Set **Default Models** for general questions
3. Set **RAG Model** for PDF-related questions

### API Endpoints
- `GET /api/config/models` - Get current model configuration
- `POST /api/config/models` - Update model configuration

## Usage Examples

### Example 1: General Question
User asks: "What is the capital of France?"
- No files attached
- System routes to: `DEFAULT_MODELS` (gemma4)
- Response: Standard conversational answer

### Example 2: PDF-Related Question
User asks: "Summarize the key points in this document" + attaches PDF
- PDF file detected in attachments
- System routes to: `RAG_MODEL` (gemma4)
- Response: Uses RAG capabilities to analyze the PDF

## Technical Implementation

### Modified Files
1. `docker-compose.yaml` - Added environment variables
2. `backend/open_webui/config.py` - Added RAG_MODEL configuration
3. `backend/open_webui/main.py` - Implemented routing logic in chat completion
4. `backend/open_webui/routers/configs.py` - Added RAG_MODEL to admin config API

### Routing Logic
The routing is implemented in `main.py` in the `chat_completion` function:
```python
files = metadata.get("files", [])
has_pdf_files = any(
    file.get("type") == "file" and
    (file.get("meta", {}).get("name", "").lower().endswith(".pdf") or
     file.get("filename", "").lower().endswith(".pdf"))
    for file in files
)

if has_pdf_files and request.app.state.config.RAG_MODEL:
    rag_model_id = request.app.state.config.RAG_MODEL
    if rag_model_id in request.app.state.MODELS:
        log.info(f"PDF files detected, routing to RAG model: {rag_model_id}")
        form_data["model"] = rag_model_id
        model_id = rag_model_id
        model = request.app.state.MODELS[rag_model_id]
        metadata["model"] = model
```

## Customization

### Using Different Models
You can configure different models for different purposes:

```yaml
environment:
  - 'DEFAULT_MODELS=gemma4'           # Fast model for general chat
  - 'RAG_MODEL=llama3.1:8b'           # Larger model for document analysis
```

### Disabling RAG Routing
To disable automatic routing and use the same model for all queries:
```yaml
environment:
  - 'DEFAULT_MODELS=gemma4'
  - 'RAG_MODEL='                      # Empty value disables routing
```

## Troubleshooting

### Model Not Found
If you see "Model not found" errors:
1. Ensure the specified models are available in your system
2. Check the model IDs match exactly what's available
3. Verify models are loaded in the application

### Routing Not Working
If PDFs don't trigger RAG routing:
1. Check that files are properly attached with correct metadata
2. Verify file type is detected as "file" and has .pdf extension
3. Check application logs for routing decisions
4. Ensure RAG_MODEL is set and available

### Performance Considerations
- RAG models may be slower than general chat models
- Consider using smaller models for general questions
- Use larger, more capable models for document analysis
- Monitor model switching in logs to understand routing behavior

## Future Enhancements
Potential improvements to consider:
- Support for other document types (DOCX, TXT, etc.)
- Content-based routing (analyze question content)
- User-preference based routing
- A/B testing different routing strategies
- Custom routing rules per user or group
