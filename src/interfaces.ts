import { Observable } from 'rxjs';

export const ActionStream = Symbol('ACTION_STREAM');
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

export interface RxStoreOptions<S> {
  initialState: S;
  reducer: (state: S, action: Action) => S;
}

export interface AsyncState <T = any> {
  loading: boolean;
  data: T | null;
  err: Error | null;
}

export interface LinkServiceConfig<S> {
  type: AsyncActionType;
  service: (...args: any[]) => Observable<any>;
  state: keyof S;
}
