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

