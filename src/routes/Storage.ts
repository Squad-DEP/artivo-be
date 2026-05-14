import express from 'express';
import { body, query, validationResult, matchedData } from 'express-validator';
import passport from '../providers/Passport';
import { DocumentService } from '../services/storage/DocumentService';
import { isStorageConfigured } from '../config/storage.config';

export const app = express.Router();

const documentService = new DocumentService();

const DOCUMENT_TYPES = ['profile_photo', 'certificate', 'business_card', 'generated_card', 'other'] as const;

/**
 * POST /storage/initiate-upload
 *
 * Creates a DB record (status=pending) first, then returns a presigned upload URL.
 * The client must call PATCH /documents/:id/confirm after the upload succeeds.
 */
app.post('/storage/initiate-upload', [
    passport.authenticate('jwt', { session: false }),
    body('fileName').notEmpty().withMessage('fileName is required'),
    body('contentType').notEmpty().withMessage('contentType is required'),
    body('documentType').isIn(DOCUMENT_TYPES).withMessage('Invalid documentType'),
    body('fileSize').optional().isInt({ min: 1 }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if (!isStorageConfigured()) {
            return res.status(503).json({ msg: 'Storage service not configured' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.mapped() });
        }

        const data = matchedData(req) as {
            fileName: string;
            contentType: string;
            documentType: typeof DOCUMENT_TYPES[number];
            fileSize?: number;
        };

        const result = await documentService.initiateUpload({
            userId: req.user.id,
            ...data,
        });

        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
});

/**
 * PATCH /documents/:id/confirm
 *
 * Called by the client after a successful R2 upload.
 * Marks the document status as 'uploaded'.
 */
app.patch('/documents/:id/confirm', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const document = await documentService.confirmUpload(req.params.id, req.user.id);
        return res.json(document);
    } catch (error) {
        return next(error);
    }
});

/**
 * PATCH /documents/:id/failed
 *
 * Called by the client if the R2 upload fails, so the pending record is cleaned up.
 */
app.patch('/documents/:id/failed', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        await documentService.markFailed(req.params.id, req.user.id);
        return res.json({ success: true });
    } catch (error) {
        return next(error);
    }
});

/**
 * GET /documents
 *
 * Returns only uploaded documents for the authenticated user.
 */
app.get('/documents', [
    passport.authenticate('jwt', { session: false }),
    query('documentType').optional().isIn(DOCUMENT_TYPES),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.mapped() });
        }

        const data = matchedData(req);
        const documents = await documentService.getUserDocuments(req.user.id, data.documentType);
        return res.json(documents);
    } catch (error) {
        return next(error);
    }
});

/**
 * GET /documents/:id
 */
app.get('/documents/:id', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const document = await documentService.getDocumentById(req.params.id);

        if (!document) {
            return res.status(404).json({ msg: 'Document not found' });
        }

        if (document.userId !== req.user.id) {
            return res.status(403).json({ msg: 'Forbidden' });
        }

        return res.json(document);
    } catch (error) {
        return next(error);
    }
});

/**
 * DELETE /documents/:id
 *
 * Deletes the DB record and removes the file from R2.
 */
app.delete('/documents/:id', [
    passport.authenticate('jwt', { session: false }),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        await documentService.deleteDocument(req.params.id, req.user.id);
        return res.json({ success: true });
    } catch (error) {
        return next(error);
    }
});
