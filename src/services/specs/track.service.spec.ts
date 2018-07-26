import { container } from '../../ioc.container';
import * as chai from 'chai';
import { expect } from 'chai';
import {} from 'chai-shallow-deep-equal';
import { TrackServiceInterface, TrackServiceType } from '../track.service';
import { Track, TRACK_STATUS_AWAITING, TRACK_TYPE_USER, TRACK_STATUS_ACTIVE } from '../../entities/track';
import { getConnection } from 'typeorm';
import { User } from '../../entities/user';

chai.use(require('chai-shallow-deep-equal'));

const trackService = container.get<TrackServiceInterface>(TrackServiceType);
const EXISTING_TRACK_ID = '5a041e9295b9822e1b617777';

describe('trackService', () => {
  it('should create new track', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = {
      betAmount: '1000',
      maxPlayers: 4,
      numPlayers: 0,
      status: TRACK_STATUS_AWAITING,
      type: TRACK_TYPE_USER,
      creator: user.id,
      duration: 300,
      users: [user.id.toHexString()]
    };

    const result = await trackService.createTrack(user, 'seed', '1000');
    expect(result).to.shallowDeepEqual(track);
  });

  it('should get awaiting tracks', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = {
      betAmount: '1000',
      maxPlayers: 4,
      numPlayers: 0,
      status: TRACK_STATUS_AWAITING,
      type: TRACK_TYPE_USER,
      creator: user.id,
      duration: 300,
      users: [user.id.toHexString()]
    };

    await trackService.createTrack(user, 'seed', '1000');
    const result = await trackService.awaitingTracks();

    expect(result).to.shallowDeepEqual([track]);
  });

  it('should get active tracks', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = {
      betAmount: '1000',
      maxPlayers: 4,
      numPlayers: 0,
      status: TRACK_STATUS_ACTIVE,
      type: TRACK_TYPE_USER,
      creator: user.id,
      duration: 300,
      users: [user.id.toHexString()]
    };

    const savedTrack = await trackService.createTrack(user, 'seed', '1000');
    await trackService.startTrack(savedTrack.id.toHexString());
    const result = await trackService.activeTracks();

    expect(result).to.shallowDeepEqual([track]);
  });

  it('should join track', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});
    const user2 = await getConnection().mongoManager.findOne(User, {where: {email: 'kyc.verified@test.com'}});

    const createdTrack = await trackService.createTrack(user, 'seed', '1000');
    const returnedTrack = await trackService.joinToTrack(user2, 'seed', createdTrack.id.toHexString());

    expect(returnedTrack.users).to.shallowDeepEqual([user.id, user2.id]);
  });

  it('should set portfolio', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = await trackService.createTrack(user, 'seed', '1000');

    const assets: Array<Asset> = [
      {name: 'btc', value: 10},
      {name: 'eth', value: 90}
    ];

    const result = await trackService.setPortfolio(user, 'seed', track.id.toHexString(), assets);

    expect(result.assets).to.deep.eq(assets);
  });

  it('should get portfolio', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = await trackService.createTrack(user, 'seed', '1000');

    const assets: Array<Asset> = [
      {name: 'btc', value: 10},
      {name: 'eth', value: 90}
    ];

    const portfolio = await trackService.setPortfolio(user, 'seed', track.id.toHexString(), assets);
    const result = await trackService.getPortfolio(user, track.id.toHexString());

    expect(result.assets).to.shallowDeepEqual(portfolio.assets);
  });

  it('should get all tracks', async() => {
    const storedTrack = await trackService.getTrackById(EXISTING_TRACK_ID);
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = await trackService.createTrack(user, 'seed', '1000');
    const result = await trackService.getAllTracks();

    expect(result).to.shallowDeepEqual([storedTrack, track]);
  });

  it('should get track by name', async() => {
    const storedTrack = await getConnection().mongoManager.findOne(Track, {where: {name: 'starTrack'}});
    const result = await trackService.getTrackById(EXISTING_TRACK_ID);

    expect(result).to.shallowDeepEqual(storedTrack);
  });

  it('should get tracks by user', async() => {
    const storedTrack = await getConnection().mongoManager.findOne(Track, {where: {name: 'starTrack'}});
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});
    const result = await trackService.getTracksByUser(user);

    expect(result).to.shallowDeepEqual([storedTrack]);
  });

  it('should get players from track', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});
    const user2 = await getConnection().mongoManager.findOne(User, {where: {email: 'kyc.verified@test.com'}});

    const track = await trackService.createTrack(user, 'seed', '1000');
    await trackService.joinToTrack(user2, 'seed', track.id.toHexString());

    const result = await trackService.getPlayers(track.id.toHexString());
    expect(result).to.shallowDeepEqual([user, user2]);
  });

  it('should start track', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});

    const track = await trackService.createTrack(user, 'seed', '1000');

    await trackService.startTrack(track.id.toHexString());
    const result = await trackService.getTrackById(track.id.toHexString());

    expect(result.status).to.eq(TRACK_STATUS_ACTIVE);
  });
});
