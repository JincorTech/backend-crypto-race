import * as Joi from 'joi';
import config from '../config';
import { Response, Request, NextFunction } from 'express';
import { AuthorizedRequest } from '../requests/authorized.request';
import { base64decode } from '../helpers/helpers';
import * as fs from 'fs';
import * as i18next from 'i18next';
import { responseErrorWithObject } from '../helpers/responses';

const options = {
  allowUnknown: true,
  language: {}
};

const verificationSchema = Joi.object().keys({
  verificationId: Joi.string().required(),
  code: Joi.string().required(),
  method: Joi.string().required()
}).required();

const passwordRegex = /^[a-zA-Z0\d!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]{8,}$/;

export function createUser(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    name: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    password: Joi.string().required().regex(passwordRegex).options({
      language: {
        string: {
          regex: {
            base: translateCustomMessage('must be at least 8 characters, contain at least one number, 1 small and 1 capital letter', req)
          }
        }
      }
    }),
    agreeTos: Joi.boolean().only(true).required()
  });

  if (req.body.referral) {
    req.body.referral = base64decode(req.body.referral);
  }

  commonValidate(422, schema, req, res, next);
}

export function activateUser(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
    verificationId: Joi.string().required(),
    code: Joi.string().required()
  });

  commonValidate(422, schema, req, res, next);
}

export function initiateLogin(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  commonValidate(422, schema, req, res, next);
}

export function verifyLogin(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    accessToken: Joi.string().required(),
    verification: Joi.object().keys({
      id: Joi.string().required(),
      code: Joi.string().required(),
      method: Joi.string().required()
    })
  });

  commonValidate(422, schema, req, res, next);
}

export function changePassword(req: AuthorizedRequest, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().required().regex(passwordRegex)
  });

  commonValidate(422, schema, req, res, next);
}

export function resetPasswordInitiate(req: AuthorizedRequest, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().required().email()
  });

  commonValidate(422, schema, req, res, next);
}

export function resetPasswordVerify(req: AuthorizedRequest, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().regex(passwordRegex),
    verification: verificationSchema
  });

  commonValidate(422, schema, req, res, next);
}

export function verificationRequired(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    verification: verificationSchema
  });

  commonValidate(422, schema, req, res, next);
}

export function resendVerification(req: Request, res: Response, next: NextFunction) {
  const schema = Joi.object().keys({
    email: Joi.string().email().required()
  });

  commonValidate(422, schema, req, res, next);
}

export function onlyAcceptApplicationJson(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'OPTIONS' && req.header('Accept') !== 'application/json' && req.header('Content-Type') === 'application/json') {
    responseErrorWithObject(res, {
      message: 'Unsupported "Accept" header'
    }, 406);
  } else {
    return next();
  }
}

export function commonValidate(code: number, schema: Joi.Schema, req: Request, res: Response, next: NextFunction) {
  const lang = req.acceptsLanguages() || 'en';
  const langPath = __dirname + `/../resources/locales/${lang}/validation.json`;

  if (fs.existsSync(langPath)) {
    options.language = require(langPath);
  }

  const result = Joi.validate(req.body, schema, options);
  if (result.error) {
    responseErrorWithObject(res,{
      message: result.error.details[0].message
    }, code);
  } else {
    return next();
  }
}

export function translateCustomMessage(message: string, req: Request) {
  const lang = req.acceptsLanguages() || 'en';
  const langPath = __dirname + `/../resources/locales/${lang}/errors.json`;
  const translations = fs.existsSync(langPath) ? require(langPath) : null;

  i18next.init({
    lng: lang.toString(),
    resources: translations
  });

  return i18next.t(message);
}
