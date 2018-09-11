import 'reflect-metadata';
import { pipe, merge, concat, BehaviorSubject, Observable, Subject } from 'rxjs';
import { startWith, tap, filter, share, shareReplay, refCount, map, scan, withLatestFrom } from 'rxjs/operators';
import { injectable, inject, Container } from 'inversify';

export const ActionStream = Symbol('ACTION_STREAM');
export type ActionType = string | symbol;

export function ofType<T> (...types: any[]) {
  if (types.length === 1 && Array.isArray(types[0])) {
    types = types[0];
  }

  return (action$: Observable<Action<T>>) => action$.pipe(
    filter((action: Action<T>) => {
      return types.indexOf(action.type) >= 0;
    })
  );
}

export interface Action<P = any> {
  type: ActionType;
  payload?: P;
}

export interface RxStoreOptions<S> {
  initialState: S;
  reducer: (state: S, action: Action) => S;
}

const effectNamesKey = Symbol('effectnames');

export function Effect (target: any, key: string, descriptor: any) {
  let effectNames = Reflect.getMetadata(effectNamesKey, target);
  if (effectNames) {
    effectNames = effectNames + '|' + key;
  } else {
    effectNames = key;
  }

  Reflect.defineMetadata(effectNamesKey, effectNames, target);
}

@injectable()
export abstract class RxStore<S = any> {
  public state$!: Observable<S>;
  public options!: RxStoreOptions<S>;

  @inject(ActionStream)
  protected action$!: Subject<Action>;
  private unsubscriber!: {unsubscribe: () => void};

  public dispatch<T = any> (action: Action<T>) {
    this.action$.next(action);
  }

  public destroy () {
    if (this.unsubscriber) {
      this.unsubscriber.unsubscribe();
    }
  }

  protected init (options: RxStoreOptions<S>) {
    this.options = options;
    const initAction = {type: Symbol('@@INIT')};

    const effectNames = Reflect.getMetadata(effectNamesKey, this);
    const effectMethodNames = effectNames ? effectNames.split('|') : [];

    const effects: Array<Observable<Action>> = [];
    for (const name of effectMethodNames) {
      effects.push((this as any)[name]());
    }

    const actionWithEffects$ = merge.apply(null, effects);

    this.state$ = this.action$.pipe(
      scan(this.options.reducer, this.options.initialState),
      shareReplay(1),
    );

    const withEffect$ = merge(
      this.state$,
      actionWithEffects$
    );

    this.unsubscriber = withEffect$.subscribe();
    this.dispatch(initAction);
  }

  protected put<T = any> (action: Action<T>) {
    return (effect$: Observable<any>) => effect$.pipe(
      tap(() => this.dispatch(action))
    );
  }
}


