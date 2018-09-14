import { merge, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, filter, scan, shareReplay } from 'rxjs/operators';
import { inject, injectable } from 'inversify';
import { asyncTypeDefNamesKey, effectNamesKey, typeDefNamesKey } from './metadataKeys';
import { Action, ActionStream, RxStoreOptions } from './interfaces';

@injectable()
export abstract class RxStore<S = any> {
  public state$!: Observable<S>;
  public options!: RxStoreOptions<S>;

  @inject(ActionStream)
  protected action$!: Subject<Action>;
  private unsubscriber!: { unsubscribe: () => void };

  constructor () {
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
    const asyncTypeNamesStr = Reflect.getMetadata(asyncTypeDefNamesKey, this) || '';
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
