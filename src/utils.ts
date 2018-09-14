import { AsyncActionType, AsyncState, LinkServiceConfig } from './interfaces';

export function getInitialAsyncState<T = any> (initialData?: T): AsyncState<T> {
  return {
    loading: false,
    err: null,
    data: initialData ? initialData : null,
  };
}

export function isAsyncActionType (obj: AsyncActionType): obj is AsyncActionType {
  return obj && typeof obj.START === 'symbol' && typeof obj.ERR === 'symbol' && typeof obj.END === 'symbol';
}

export function isLinkServiceConfig<T> (obj: LinkServiceConfig<T>): obj is LinkServiceConfig<T> {
  return typeof obj.service === 'function' && isAsyncActionType(obj.type);
}
