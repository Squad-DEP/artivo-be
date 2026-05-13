import express from 'express';
import { body, query, validationResult, matchedData } from 'express-validator';
import passport from '../providers/Passport';
import { DocumentService } from '../services/storage/DocumentService';
import { isStorageConfigured } from '../config/storage.config';

export const app = express.Router();

const documentService = new DocumentService();

app.get('/storage/presigned-url', [
    passport.authenticate('jwt', { session: false }),
    query('fileName').notEmpty().withMessage('fileName is required'),
    query('contentType').notEmpty().withMessage('contentType is required'),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if (!isStorageConfigured()) {
            return res.status(503).json({ msg: 'Storage service not configured' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.mapped() });
        }

        const data = matchedData(req);
        const result = await documentService.getPresignedUploadUrl(
            req.user.id,
            data.fileName,
            data.contentType
        );

        return res.json(result);
    } catch (error) {
        return next(error);
    }
});

app.post('/documents', [
    passport.authenticate('jwt', { session: false }),
    body('documentType').isIn(['profile_photo', 'certificate', 'business_card', 'generated_card', 'other']),
    body('fileUrl').notEmpty(),
    body('fileName').optional(),
    body('fileSize').optional().isInt(),
    body('mimeType').optional(),
    body('metadata').optional().isObject(),
], async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.mapped() });
        }

        const data = matchedData(req) as {
            documentType: 'profile_photo' | 'certificate' | 'business_card' | 'generated_card' | 'other';
            fileUrl: string;
            fileName?: string;
            fileSize?: number;
            mimeType?: string;
            metadata?: Record<string, any>;
        };
        const document = await documentService.createDocument({
            ...data,
            userId: req.user.id,
        });

        return res.status(201).json(document);
    } catch (error) {
        return next(error);
    }
});

app.get('/documents', [
    passport.authenticate('jwt', { session: false }),
    query('documentType').optional().isIn(['profile_photo', 'certificate', 'business_card', 'generated_card', 'other']),
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
