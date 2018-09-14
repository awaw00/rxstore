import { filter } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Action } from './interfaces';

export function ofType<T> (...types: any[]) {
  if (types.length === 1 && Array.isArray(types[0])) {
    types = types[0];
  }

  return (action$: Observable<Action<T>>) => action$.pipe(
    filter((action: Action<T>) => {
      return types.indexOf(action.type) >= 0;
    }),
  );
}
