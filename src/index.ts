import 'reflect-metadata';
import { merge, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, filter, scan, shareReplay } from 'rxjs/operators';
import { inject, injectable } from 'inversify';

export const ActionStream = Symbol('ACTION_STREAM');
export type ActionType = string | symbol;

export interface AsyncActionType {
  START: ActionType;
  END: ActionType;
  ERR: ActionType;
}

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

export interface Action<P = any> {
  type: ActionType;
  payload?: P;
}

export interface RxStoreOptions<S> {
  initialState: S;
  reducer: (state: S, action: Action) => S;
}

const effectNamesKey = Symbol('effectnames');
const typeDefNamesKey = Symbol('typenames');
const asyncTypeDefNamesKey = Symbol('asynctypenames');

function addKeys (namesKey: symbol) {
  return function (target: any, key: string) {
    let names = Reflect.getMetadata(namesKey, target);
    if (names) {
      names = names + '|' + key;
    } else {
      names = key;
    }

    Reflect.defineMetadata(namesKey, names, target);
  };
}

export function effect (target: any, key: string, descriptor: any) {
  addKeys(effectNamesKey)(target, key);
}

export function typeDef (target: any, key: string) {
  addKeys(typeDefNamesKey)(target, key);
}

export function asyncTypeDef (target: any, key: string) {
  addKeys(asyncTypeDefNamesKey)(target, key);
}

@injectable()
export abstract class RxStore<S = any> {
  public state$!: Observable<S>;
  public options!: RxStoreOptions<S>;

  @inject(ActionStream)
  protected action$!: Subject<Action>;
  private unsubscriber!: { unsubscribe: () => void };

  protected constructor () {
    this.setTypesValue();
    this.setAsyncTypesValue();
  }

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

    this.state$ = this.action$.pipe(
      scan(this.options.reducer, this.options.initialState),
      distinctUntilChanged(),
      shareReplay(1),
    );

    const effectNames = Reflect.getMetadata(effectNamesKey, this);
    const effectMethodNames = effectNames ? effectNames.split('|') : [];

    const effects: Array<Observable<Action>> = [];
    for (const name of effectMethodNames) {
      effects.push((this as any)[name]());
    }

    const actionWithEffects$ = merge.apply(null, effects);

    const withEffect$ = merge(
      this.state$,
      actionWithEffects$,
    );

    this.unsubscriber = withEffect$.subscribe();
    this.dispatch({type: Symbol('@@INIT')});
  }

  private setTypesValue () {
    const typeNamesStr = Reflect.getMetadata(typeDefNamesKey, this) || '';
    const typeNames = typeNamesStr.split('|');

    for (const name of typeNames) {
      (this as any)[name] = Symbol(name);
    }
  }

  private setAsyncTypesValue () {
    const asyncTypeNamesStr = Reflect.getMetadata(typeDefNamesKey, this) || '';
    const asyncTypeNames = asyncTypeNamesStr.split('|');

    for (const name of asyncTypeNames) {
      (this as any)[name] = {
        START: Symbol(`${name}/START`),
        END: Symbol(`${name}/END`),
        ERR: Symbol(`${name}/ERR`),
      };
    }
  }
}
