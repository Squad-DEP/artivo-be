import { SignOptions, sign } from 'jsonwebtoken';
import { UserModel } from './../models/User';
import Mustache from 'mustache';
import * as path from 'path';
import * as fs from 'fs';

const ucFirst = (string: string) => string.charAt(0).toUpperCase() + string.slice(1);

const generateEmail = (template: string, params: object = {}) => {
    return Mustache.render(fs.readFileSync(path.resolve('./src/emails/layout/Header.html'), 'utf8'), params).concat(
        Mustache.render(fs.readFileSync(path.resolve(`./src/emails/${template}.html`), 'utf8'), params),
    ).concat(
        Mustache.render(fs.readFileSync(path.resolve('./src/emails/layout/Footer.html'), 'utf8'), params),
    );
};

const generateJWT = (user: UserModel, signOptions: SignOptions) => {
    const payload = {
        id: user.get('id'),
        email: user.get('email'),
    };

    return sign(
        payload,
        process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        signOptions,
    );
};

export {
    ucFirst,
    generateEmail,
    generateJWT,
};