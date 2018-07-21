import { container } from '../../ioc.container';
import * as chai from 'chai';
import { expect } from 'chai';
import {} from 'chai-shallow-deep-equal';
import { TrackServiceInterface, TrackServiceType } from '../track.service';
import { Track, TRACK_STATUS_PENDING, TRACK_TYPE_USER } from '../../entities/track';
import { getConnection } from 'typeorm';
import { User } from '../../entities/user';

chai.use(require('chai-shallow-deep-equal'));

const trackService = container.get<TrackServiceInterface>(TrackServiceType);

describe('trackService', () => {
  it('should create new track', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = new Track();
    track.betAmount = '1000';
    track.numPlayers = 4;
    track.status = TRACK_STATUS_PENDING;
    track.type = TRACK_TYPE_USER;
    track.creator = user.id;
    track.duration = 300;
    track.name = 'toTheMoon';
    track.timestamp = Date.now();
    track.hash = '123456';

    const result = await trackService.createTrack(user, 'seed', track);
    expect(result).to.shallowDeepEqual(track);
  });

  it('should get awaiting tracks', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = new Track();
    track.betAmount = '1000';
    track.numPlayers = 4;
    track.status = TRACK_STATUS_PENDING;
    track.type = TRACK_TYPE_USER;
    track.creator = user.id;
    track.duration = 300;
    track.name = 'toTheMoon';
    track.timestamp = Date.now();
    track.hash = '123456';
    track.isActive = false;

    await trackService.createTrack(user, 'seed', track);
    const result = await trackService.awaitingTracks();

    expect(result).to.shallowDeepEqual([track]);
  });

  it('should get active tracks', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = new Track();
    track.betAmount = '1000';
    track.numPlayers = 4;
    track.status = TRACK_STATUS_PENDING;
    track.type = TRACK_TYPE_USER;
    track.creator = user.id;
    track.duration = 300;
    track.name = 'toTheMoon';
    track.timestamp = Date.now();
    track.hash = '123456';
    track.isActive = true;

    await trackService.createTrack(user, 'seed', track);
    const result = await trackService.activeTracks();

    expect(result).to.shallowDeepEqual([track]);
  });

  it('should join track', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = new Track();
    track.betAmount = '1000';
    track.numPlayers = 4;
    track.status = TRACK_STATUS_PENDING;
    track.type = TRACK_TYPE_USER;
    track.creator = user.id;
    track.duration = 300;
    track.name = 'toTheMoon';
    track.timestamp = Date.now();
    track.hash = '123456';
    track.isActive = true;

    await trackService.createTrack(user, 'seed', track);
    const result = await trackService.joinToTrack(user, 'seed', 'toTheMoon');

    expect(result).to.eq(true);
  });

  it('should set portfolio', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = new Track();
    track.betAmount = '1000';
    track.numPlayers = 4;
    track.status = TRACK_STATUS_PENDING;
    track.type = TRACK_TYPE_USER;
    track.creator = user.id;
    track.duration = 300;
    track.name = 'toTheMoon';
    track.timestamp = Date.now();
    track.hash = '123456';
    track.isActive = false;

    await trackService.createTrack(user, 'seed', track);

    const assets: Array<Asset> = [
      {name: 'btc', value: 10},
      {name: 'eth', value: 90}
    ];

    const result = await trackService.setPortfolio(user, 'seed', 'toTheMoon', assets);

    expect(result.assets).to.deep.eq(assets);
  });

  it('should get all tracks', async() => {
    const storedTrack = await getConnection().mongoManager.findOne(Track, {where: {name: 'starTrack'}});
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = new Track();
    track.betAmount = '1000';
    track.numPlayers = 4;
    track.status = TRACK_STATUS_PENDING;
    track.type = TRACK_TYPE_USER;
    track.creator = user.id;
    track.duration = 300;
    track.name = 'toTheMoon';
    track.timestamp = Date.now();
    track.hash = '123456';
    track.isActive = false;

    await trackService.createTrack(user, 'seed', track);
    const result = await trackService.getAllTracks();

    expect(result).to.shallowDeepEqual([storedTrack, track]);
  });

  it('should get track by name', async() => {
    const storedTrack = await getConnection().mongoManager.findOne(Track, {where: {name: 'starTrack'}});
    const result = await trackService.getTrackByName('starTrack');

    expect(result).to.shallowDeepEqual(storedTrack);
  });

  it('should get tracks by user', async() => {
    const storedTrack = await getConnection().mongoManager.findOne(Track, {where: {name: 'starTrack'}});
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});
    const result = await trackService.getTracksByUser(user);

    expect(result).to.shallowDeepEqual([storedTrack]);
  });
});
