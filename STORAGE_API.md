# Storage & Documents API

## Get Presigned Upload URL
GET /api/v1/storage/presigned-url?fileName=photo.jpg&contentType=image/jpeg
Authorization: Bearer {token}

Response:
```json
{
  "uploadUrl": "https://...",
  "fileKey": "user-id/uuid.jpg",
  "publicUrl": "https://..."
}
```

Frontend uploads file to uploadUrl using PUT request, then saves the publicUrl.

## Save Document Record
POST /api/v1/documents
Authorization: Bearer {token}
```json
{
  "documentType": "profile_photo",
  "fileUrl": "https://...",
  "fileName": "photo.jpg",
  "fileSize": 123456,
  "mimeType": "image/jpeg",
  "metadata": {}
}
```

documentType: profile_photo | certificate | business_card | generated_card | other

## Get User Documents
GET /api/v1/documents
GET /api/v1/documents?documentType=profile_photo
Authorization: Bearer {token}

## Get Single Document
GET /api/v1/documents/{id}
Authorization: Bearer {token}

## Delete Document
DELETE /api/v1/documents/{id}
Authorization: Bearer {token}
