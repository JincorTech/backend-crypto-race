declare interface RegistrationResult {
  id: string;
  email: string;
  login: string;
}

declare interface TenantRegistrationResult extends RegistrationResult {

}

declare interface UserRegistrationResult extends RegistrationResult {
  tenant: string;
  sub: string;
  scope?: any;
}

declare interface VerificationResult {
  id: string;
  login: string;
  jti: string;
  iat: number;
  aud: string;
}

declare interface TenantVerificationResult extends VerificationResult {
  isTenant: boolean;
}

declare interface UserVerificationResult extends VerificationResult {
  deviceId: string;
  sub: string;
  exp: number;
  scope?: any;
}

declare interface UserVerificationResponse {
  decoded: UserVerificationResult;
}

declare interface TenantVerificationResponse {
  decoded: TenantVerificationResult;
}

declare interface AuthUserData {
  email: string;
  login: string;
  password: string;
  sub: string;
  scope?: any;
}

declare interface UserLoginData {
  login: string;
  password: string;
  deviceId: string;
}

declare interface AccessTokenResponse {
  accessToken: string;
}

declare interface AuthClientInterface {
  tenantToken: string;
  registerTenant(email: string, password: string): Promise<TenantRegistrationResult>;
  loginTenant(email: string, password: string): Promise<AccessTokenResponse>;
  verifyTenantToken(token: string): Promise<TenantVerificationResult>;
  logoutTenant(token: string): Promise<void>;
  createUser(data: AuthUserData): Promise<UserRegistrationResult>;
  loginUser(data: UserLoginData): Promise<AccessTokenResponse>;
  verifyUserToken(token: string): Promise<UserVerificationResult>;
  logoutUser(token: string): Promise<void>;
  deleteUser(login: string): Promise<void>;
}

declare interface InitiateData {
  consumer: string;
  issuer?: string;
  template?: {
    body: string;
    fromEmail?: string;
    subject?: string;
  };
  generateCode?: {
    length: number;
    symbolSet: Array<string>;
  };
  policy: {
    expiredOn: string;
    verificationId?: string
  };
  payload?: any;
}

declare interface Result {
  status: number;
}

declare interface InitiateResult extends Result {
  verificationId: string;
  attempts: number;
  expiredOn: number;
  method: string;
  code?: string;
  totpUri?: string;
  qrPngDataUri?: string;
}

declare interface ValidationResult extends Result {
  data?: {
    verificationId: string;
    consumer: string;
    expiredOn: number;
    attempts: number;
    payload?: any;
  };
}

declare interface ValidateVerificationInput {
  code: string;
  removeSecret?: boolean;
}

declare interface VerificationClientInterface {
  initiateVerification(method: string, data: InitiateData): Promise<InitiateResult>;
  resendVerification(method: string, data: InitiateData): Promise<InitiateResult>;
  validateVerification(method: string, id: string, input: ValidateVerificationInput): Promise<ValidationResult>;
  invalidateVerification(method: string, id: string): Promise<void>;
  getVerification(method: string, id: string): Promise<ValidationResult>;
  checkVerificationPayloadAndCode(input: VerificationData, consumer: string, payload: any, removeSecret?: boolean);
}

declare interface UserData {
  email: string;
  name: string;
  agreeTos: boolean;
  passwordHash?: string;
  source?: any;
  picture?: any;
}

declare interface InputUserData extends UserData {
  password: string;
}

declare interface Wallet {
  ticker: string;
  address: string;
  balance: string;
  salt?: string;
}

declare interface NewWallet extends Wallet {
  privateKey: string;
  mnemonic: string;
}

declare interface CreatedUserData extends UserData {
  id: string;
  name: string;
  verification: {
    id: string,
    method: string
  };
  isVerified: boolean;
  defaultVerificationMethod: string;
}

declare interface BaseInitiateResult {
  verification: InitiateResult;
}

declare interface InitiateLoginResult extends BaseInitiateResult {
  accessToken: string;
  isVerified: boolean;
}

declare interface VerifyLoginResult extends InitiateLoginResult {

}

declare interface ActivationUserData {
  email: string;
  verificationId: string;
  code: string;
}

declare interface ActivationResult {
  accessToken: string;
  wallets: Array<NewWallet>;
}

declare interface InitiateLoginInput {
  email: string;
  password: string;
}

declare interface VerifyLoginInput {
  accessToken: string;
  verification: {
    id: string,
    code: string,
    method: string
  };
}

declare interface ResendVerificationInput {
  email: string
}

declare interface InitiateChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

declare interface InviteResult {
  email: string;
  invited: boolean;
}

declare interface InviteResultArray {
  emails: Array<InviteResult>;
}

declare interface VerificationData {
  verificationId: string;
  code: string;
  method: string;
}

declare interface VerificationInput {
  verification?: VerificationData;
}

declare interface ResetPasswordInput extends VerificationInput {
  email: string;
  password: string;
}

declare interface Enable2faResult {
  enabled: boolean;
}

declare interface UserInfo {
  ethAddress: string;
  email: string;
  name: string;
  defaultVerificationMethod: string;
}

interface TransactionInput {
  from?: string;
  to: string;
  amount: string;
  gas: number;
  gasPrice: string;
}

declare interface UserServiceInterface {
  create(userData: InputUserData): Promise<any>;
  createActivatedUser(userData: InputUserData): Promise<any>;
  activate(activationData: ActivationUserData): Promise<ActivationResult>;
  initiateLogin(inputData: InitiateLoginInput, ip: string): Promise<InitiateLoginResult>;
  initiateChangePassword(user: any, params: InitiateChangePasswordInput): Promise<BaseInitiateResult>;
  verifyChangePassword(user: any, params: InitiateChangePasswordInput): Promise<AccessTokenResponse>;
  initiateEnable2fa(user: any): Promise<BaseInitiateResult>;
  verifyEnable2fa(user: any, params: VerificationInput): Promise<Enable2faResult>;
  initiateDisable2fa(user: any): Promise<BaseInitiateResult>;
  verifyDisable2fa(user: any, params: VerificationInput): Promise<Enable2faResult>;
  initiateResetPassword(params: ResetPasswordInput): Promise<BaseInitiateResult>;
  verifyResetPassword(params: ResetPasswordInput): Promise<ValidationResult>;
  verifyLogin(inputData: VerifyLoginInput): Promise<VerifyLoginResult>;
  getUserInfo(user: any): Promise<UserInfo>;
  resendVerification(userData: ResendVerificationInput): Promise<CreatedUserData>;
}

declare interface EmailServiceInterface {
  send(sender: string, recipient: string, subject: string, text: string): Promise<any>;
}

declare interface CoinpaymentsTransactionData {
  amount: number;
  currency: string;
  buyer_email: string;
}

declare interface CoinpaymentsTransactionInfo { 
  time_created: number;
  time_expires: number;
  status: number;
  status_text: string;
  type: string;
  coin: string;
  amount: number;
  amountf: string;
  received: number;
  receivedf: string;
  recv_confirms: number;
  payment_address: string;
}

declare interface ExchangeRateInterface {
  is_fiat: number;
  rate_btc: string;
  last_update: string;
  tx_fee: string;
  status: string;
  name: string;
  confirms: string;
  can_convert: number;
  capabilities: string[];
}

declare interface CoinpaymentsClientInterface {
  createTransaction(transactionData: CoinpaymentsTransactionData): Promise<any>;
  convertCoinsTransaction(transactionData: any): Promise<any>;
  rates(options?: { short?: number; accepted?: number; }): Promise<ExchangeRateInterface>;
  getTransactionInfo(txId: string): Promise<CoinpaymentsTransactionInfo>;
  getTransactionMulti(txIds: string[]): Promise<{ [txId: string]: CoinpaymentsTransactionInfo }>;
}

declare interface IPNApiTypeResponse {
  ipn_version: string;
  ipn_type: string;
  ipn_mode: string;
  ipn_id: string;
  merchant: string;

  // API fields
  staus: number;
  status_text: string;
  txn_id: string;
  currency1: string;
  currency2: string;
  amount1: number;
  amount2: number;
  fee: number;
  net: string;
  buyer_name: string;
  email: string;
  item_name: string;
  item_number: string;

  received_amount: number;
  received_confirms: number;

  // Custom fields
  timestamp: number;
}

declare interface PaymentGateTransactionInterface {
	type: string;
  status: string;
  userEmail: string;
  expiredOn: number;
  buyCoinpaymentsData: any;
  convertCoinpaymentsData: null;
  buyIpns: Array<any>;
}

declare interface PaymentsServiceInterface {
  initiateBuyEths(currentUser: any, amount: number, displayInCurrency: string, purchaseInCurrency: string): Promise<PaymentGateTransactionInterface>;
}

declare interface IPNServiceInterface {
  processFail(data: any): Promise<PaymentGateTransactionInterface>;
  processPending(data: any): Promise<PaymentGateTransactionInterface>;
  processComplete(data: any): Promise<PaymentGateTransactionInterface>;
}

declare interface GenericTransaction {
  type: string;
}

declare interface PaymentGateTransactionView {
  id: string;
  type: string;
  status: number;
  currency: string;
  confirmsNeeded: string;
  totalAmount: string;
  receivedAmount: number;
  receivedConfirms: number;
  qrcodeUrl: string;
  address: string;
  timestamp: number;
  timeout: number;
  expiredOn: number;
  txnId: string;
  statusUrl: string;
}

declare interface EmailTemplateServiceInterface {
  getRenderedTemplate(templateName: string, data: any): Promise<string>;
}

declare interface LandingServiceInterface {
  storeEmail(email: string);
}

declare interface GameServiceInterface {
  createTrackFromBackend(id: string, betAmount: string): Promise<any>;
  joinToTrack(user: any, mnemonic: string, id: string): Promise<any>;
  setPortfolio(user: any, mnemonic: string, id: string, portfolio: any): Promise<any>;
  getAllTracks(): Promise<Array<any>>;
  getTrackByName(name: string): Promise<any>;
  getTracksByUser(user: any): Promise<any>;
}

declare interface Asset {
  name: string;
  value: number;
}

declare interface Player {
  id: string;
  position: number;
  x: number;
  ship: Ship;
  fuel: Array<Asset>;
  email: string;
  picture: any;
  name: string;
}

declare interface Ship {
  type: number;
}

declare interface InitRace {
  id: string;
  raceName: string;
  start: number;
  end: number;
  players: Array<Player>;
}

declare interface Strafe {
  id: string;
  left: boolean;
  right: boolean;
  x: number;
  email: string;
  trackId: string;
}

declare interface YPosition {
  playersYPositions: Array<PlayerYPosition>;
}

declare interface PlayerYPosition {
  id: string;
  y: number;
}

declare interface CreateTrackData {
  id: string;
  betAmount: string;
  maxPlayers: number;
  duration: number
}

declare interface JoinToTrackData {
  account: any;
  id: string;
  assets: any;
  start: number;
  betAmount: string;
}

declare interface SetPorfolioData {
  account: any;
  id: string;
  portfolio: any;
}

declare interface StartTrackData {
  id: string;
  start: number;
}

declare interface WithdrawRewardsData {
  account: any;
  id: string;
}

declare interface SetRatesData {
  timestamp: number;
  names: string[];
  amounts: number[];
}

declare interface FinishTrackData {
  id: string;
  names: string[];
  startRates: number[];
  endRates: number[];
}
