import * as passport from 'passport';
import * as request from 'request';
import * as passportFacebook from 'passport-facebook';
import * as _ from 'lodash';

// import { User, UserType } from '../models/User';
import { User } from './entities/user';
import { Request, Response, NextFunction } from 'express';
import { getConnection } from 'typeorm';

const FacebookStrategy = passportFacebook.Strategy;

passport.serializeUser<any, any>((user, done) => {
  done(undefined, user.id);
});

passport.deserializeUser((id, done) => {
  getConnection().mongoManager.findOneById(User, id).then(user => {
    done({}, user);
  });
});

/**
 * Sign in with Facebook.
 */
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_ID,
  clientSecret: process.env.FACEBOOK_SECRET,
  callbackURL: 'https://30f61bbe.ngrok.io/user/auth/facebook/callback',
  profileFields: ['email'],
  passReqToCallback: true
}, (req: any, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    getConnection().mongoManager.findOne(User, {
      where: {
        facebook: profile.id
      }
    }).then((existingUser) => {
      console.log('fb=>1');
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Facebook account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done({});
      } else {
        getConnection().mongoManager.findOne(User, { where: {
          facebook: profile.id
        }}).then(user => {
          console.log('fb=>2');
          if (user) {
            user.facebook = profile.id;
            user.tokens.push({ kind: 'facebook', accessToken });
            getConnection().mongoManager.save(User, user).then(user => {
              done({}, user);
            });
          }
        });
        getConnection().mongoManager.findOneById(User, req.user.id).then(user => {
          console.log('fb=>3');
          if (user) {
            user.facebook = profile.id;
            user.tokens.push({ kind: 'facebook', accessToken });
            getConnection().mongoManager.save(User, user).then(user => {
              done({}, user);
            });
          }
        });
      }
    });
  } else {
    console.log('fb=>4');
    getConnection().mongoManager.findOne(User, { where: {
      facebook: profile.id
    }}).then(existingUser => {
      console.log('fb=>5');
      if (existingUser) {
        console.log('deb', existingUser);
        return done(undefined, existingUser);
      }
      getConnection().mongoManager.findOne(User, { where: {
        email: profile._json.email
      }}).then(existingEmailUser => {
        console.log('fb=>6');
        if (existingEmailUser) {
          req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Facebook manually from Account Settings.' });
          done(undefined);
        } else {
          console.log('fb=>7');
          const user: User = new User();
          user.email = profile._json.email;
          user.facebook = profile.id;
          console.log(user);
          user.tokens.push({ kind: 'facebook', accessToken });
          getConnection().mongoManager.save(User, user).then(user => {
            done(undefined, user);
          });
        }
      });
    });
  }
}));

/**
 * Login Required middleware.
 */
export let isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

/**
 * Authorization Required middleware.
 */
export let isAuthorized = (req: Request, res: Response, next: NextFunction) => {
  const provider = req.path.split('/').slice(-1)[0];

  if (_.find(req.user.tokens, { kind: provider })) {
    next();
  } else {
    res.redirect(`/auth/${provider}`);
  }
};