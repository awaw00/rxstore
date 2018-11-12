import { Observable } from 'rxjs';
import { RxStore } from './RxStore';

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

export interface DispatchAbleAction<P = any> extends Action<P> {
  dispatch: () => void;
}

export interface RxStoreInitOptions<S> {
  initialState: S;
  reducer?: (state: S, action: Action) => S;
  merge?: (state$: Observable<S>) => Observable<S>;
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
  errorSelector?: (payload: any) => any;
}

export interface RxStoreConfig {
  linkService?: BaseConfigLinkService;
}
