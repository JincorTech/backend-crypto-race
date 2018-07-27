import { container } from '../../ioc.container';
import * as chai from 'chai';
import { expect } from 'chai';
import {} from 'chai-shallow-deep-equal';
import { TrackServiceInterface, TrackServiceType } from '../track.service';
import { Track, TRACK_STATUS_AWAITING, TRACK_TYPE_USER, TRACK_STATUS_ACTIVE, TRACK_TYPE_BACKEND } from '../../entities/track';
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
      numPlayers: 1,
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
      numPlayers: 1,
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
    const [user1, user2, user3, user4] = await getUsers();

    const track = {
      betAmount: '1000',
      maxPlayers: 4,
      numPlayers: 1,
      status: TRACK_STATUS_ACTIVE,
      type: TRACK_TYPE_USER,
      creator: user1.id,
      duration: 300
    };

    const savedTrack = await trackService.createTrack(user1, 'seed', '1000');
    const assets: Array<Asset> = [
      {name: 'btc', value: 10},
      {name: 'eth', value: 90}
    ];

    await trackService.setPortfolio(user1, 'seed', savedTrack.id.toHexString(), assets);
    await trackService.setPortfolio(user2, 'seed', savedTrack.id.toHexString(), assets);
    await trackService.setPortfolio(user3, 'seed', savedTrack.id.toHexString(), assets);
    await trackService.setPortfolio(user4, 'seed', savedTrack.id.toHexString(), assets);
    await trackService.startTrack(savedTrack.id.toHexString(), 1532614801635);
    const result = await trackService.activeTracks();

    expect(result).to.shallowDeepEqual([track]);
  });

  it('should join track', async() => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: 'activated@test.com'}});
    const user2 = await getConnection().mongoManager.findOne(User, {where: {email: 'kyc.verified@test.com'}});

    const createdTrack = await trackService.createTrack(user, 'seed', '1000');
    const returnedTrack = await trackService.joinToTrack(user2, 'seed', createdTrack.id.toHexString());

    expect(returnedTrack.users).to.shallowDeepEqual([user.id.toHexString(), user2.id.toHexString()]);
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

    expect(result.length).to.eq(2);
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
    expect(result).to.shallowDeepEqual([user.id.toHexString(), user2.id.toHexString()]);
  });

  it('should start track', async() => {
    const [user1, user2, user3, user4] = await getUsers();

    const track = await trackService.createTrack(user1, 'seed', '1000');
    const assets: Array<Asset> = [
      {name: 'btc', value: 10},
      {name: 'eth', value: 90}
    ];
    await trackService.setPortfolio(user1, 'seed', track.id.toHexString(), assets);
    await trackService.setPortfolio(user2, 'seed', track.id.toHexString(), assets);
    await trackService.setPortfolio(user3, 'seed', track.id.toHexString(), assets);
    await trackService.setPortfolio(user4, 'seed', track.id.toHexString(), assets);
    await trackService.startTrack(track.id.toHexString(), 1532614801635);
    const result = await trackService.getTrackById(track.id.toHexString());

    expect(result.status).to.eq(TRACK_STATUS_ACTIVE);
  });

  it('should track is ready', async() => {
    const [user1, user2, user3, user4] = await getUsers();
    const track = await trackService.createTrack(user1, 'seed', '1000');

    const assets: Array<Asset> = [
      {name: 'btc', value: 10},
      {name: 'eth', value: 90}
    ];

    await trackService.setPortfolio(user1, 'seed', track.id.toHexString(), assets);
    await trackService.setPortfolio(user2, 'seed', track.id.toHexString(), assets);
    await trackService.setPortfolio(user3, 'seed', track.id.toHexString(), assets);
    await trackService.setPortfolio(user4, 'seed', track.id.toHexString(), assets);

    expect((await trackService.isReady(track.id.toHexString()))).to.eq(true);
  });

  it('should get stats', async() => {
    const [user1, user2, user3, user4] = await getUsers();
    const [assets1, assets2, assets3, assets4] = getAssets();
    const track = await trackService.createTrack(user1, 'seed', '0.1');

    await trackService.setPortfolio(user1, 'seed', track.id.toHexString(), assets1);
    await trackService.setPortfolio(user2, 'seed', track.id.toHexString(), assets2);
    await trackService.setPortfolio(user3, 'seed', track.id.toHexString(), assets3);
    await trackService.setPortfolio(user4, 'seed', track.id.toHexString(), assets4);

    await trackService.startTrack(track.id.toHexString(), 1532614801635);

    const winners = await trackService.getStats(track.id.toHexString());

    expect(winners).to.shallowDeepEqual([
      { score: 96.22129568205688 },
      { score: 95.58540756349362 },
      { score: 94.94951944493036 },
      { score: 94.31363132636712 }
    ]);
  });

  it('should get winners', async() => {
    const [user1, user2, user3, user4] = await getUsers();
    const [assets1, assets2, assets3, assets4] = getAssets();
    const track = await trackService.createTrack(user1, 'seed', '0.1');

    await trackService.setPortfolio(user1, 'seed', track.id.toHexString(), assets1);
    await trackService.setPortfolio(user2, 'seed', track.id.toHexString(), assets2);
    await trackService.setPortfolio(user3, 'seed', track.id.toHexString(), assets4);
    await trackService.setPortfolio(user4, 'seed', track.id.toHexString(), assets4);

    await trackService.startTrack(track.id.toHexString(), 1532614801635);

    const winners = await trackService.getWinners(track.id.toHexString());

    expect(winners).to.shallowDeepEqual([
      { score: 96.22129568205688 },
      { score: 96.22129568205688 }
    ]);
  });

  it('should internal create track', async() => {
    const createdTrack = await trackService.internalCreateTrack('0.01');
    const track = {
      betAmount: '0.01',
      maxPlayers: 4,
      numPlayers: 0,
      status: TRACK_STATUS_AWAITING,
      type: TRACK_TYPE_BACKEND,
      duration: 300
    };

    expect(createdTrack).to.shallowDeepEqual(track);
  });
});

async function getUsers(): Promise<Array<User>> {
  return await getConnection().mongoManager.find(User, {where: {email: {$in: ['activated@test.com', 'kyc.verified@test.com', 'kyc.verified_shuftipro@test.com', '2fa@test.com']}}});
}

function getAssets(): Array<Array<Asset>> {
  return [
    [{name: 'btc', value: 10}, {name: 'eth', value: 90}],
    [{name: 'btc', value: 20}, {name: 'eth', value: 80}],
    [{name: 'btc', value: 30}, {name: 'eth', value: 70}],
    [{name: 'btc', value: 40}, {name: 'eth', value: 60}]
  ];
}
