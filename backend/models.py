from pydantic import BaseModel, ConfigDict, Field


class OCRRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    file_data: str | None = Field(default=None, alias="fileData")
    mime_type: str | None = Field(default=None, alias="mimeType")
    file_name: str = Field(default="documento", alias="fileName", max_length=255)
    text_content: str | None = Field(default=None, alias="textContent")
