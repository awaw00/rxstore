import { Observable } from 'rxjs';
import Base = Mocha.reporters.Base;

export type ActionType = string | symbol;

export interface AsyncActionType {
  START: ActionType;
  END: ActionType;
  ERR: ActionType;
}

export interface Action<P = any> {
  type: ActionType;
  payload?: P;
}

export interface RxStoreInitOptions<S> {
  initialState: S;
  reducer: (state: S, action: Action) => S;
}

export interface AsyncState <T = any> {
  loading: boolean;
  data: T | null;
  err: any | null;
}

export interface LinkServiceConfig<S> {
  type: AsyncActionType;
  service: (...args: any[]) => Observable<any>;
  state: keyof S;
  dataSelector?: (payload: any) => any;
  errorSelector?: (payload: any) => any;
}

export interface BaseConfigLinkService {
  dataSelector?: (payload: any) => any;
  errorSelector?: (payload: any) => Error;
}

export interface RxStoreConfig {
  linkService?: BaseConfigLinkService;
}
