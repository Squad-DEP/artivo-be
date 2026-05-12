import { NextFunction, Request, Response } from 'express';
import { EmptyResultError } from 'sequelize';
import { ApiError } from './ApiError';

export default (err: any, req: Request, res: Response, next: NextFunction) => {
    // Handle custom API errors
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            msg: err.message,
            code: err.statusCode,
        });
    }

    // Handle Sequelize errors
    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            msg: 'This record already exists',
            code: 409,
            errors: err.errors?.map((e: any) => ({
                field: e.path,
                message: e.message,
            })),
        });
    }

    if (err instanceof EmptyResultError || err.name === 'EmptyResultError') {
        return res.status(404).json({
            msg: 'Resource not found',
            code: 404,
        });
    }

    if (err.name === 'SequelizeValidationError') {
        return res.status(422).json({
            msg: 'Validation error',
            code: 422,
            errors: err.errors?.map((e: any) => ({
                field: e.path,
                message: e.message,
            })),
        });
    }

    if (err.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(422).json({
            msg: 'Invalid reference - related record does not exist',
            code: 422,
        });
    }

    if (err.name === 'SequelizeDatabaseError') {
        console.error('Database error:', err);
        return res.status(500).json({
            msg: 'Database error occurred',
            code: 500,
        });
    }

    // Log unexpected errors
    console.error('Unexpected error:', err);

    // Return appropriate error response
    if (process.env.NODE_ENV === 'development') {
        return res.status(500).json({
            msg: err.message || 'Internal server error',
            code: 500,
            stack: err.stack,
        });
    } else {
        return res.status(500).json({
            msg: 'An unexpected error occurred',
            code: 500,
        });
    }
};
