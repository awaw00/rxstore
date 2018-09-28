import { merge, Observable, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, map, scan, shareReplay, switchMap, tap } from 'rxjs/operators';
import { inject, injectable, optional } from 'inversify';
import { asyncTypeDefNamesKey, effectNamesKey, typeDefNamesKey } from './metadataKeys';
import { Action, AsyncState, DispatchAbleAction, LinkServiceConfig, RxStoreConfig, RxStoreInitOptions } from './interfaces';
import { isAction, isLinkServiceConfig } from './utils';
import * as tokens from './tokens';
import { ofType } from './operators';

@injectable()
export abstract class RxStore<S extends object = any> {
  public state$!: Observable<S>;
  public options!: RxStoreInitOptions<S>;

  public dispatch = <T = any> (action: Action<T>) => {
    this.action$.next(action);
  };
  public destroy = () => {
    if (this.unsubscriber) {
      this.unsubscriber.unsubscribe();
    }
  };

  @inject(tokens.ActionStream)
  protected action$!: Subject<Action>;
  protected unsubscriber!: { unsubscribe: () => void };
  protected serviceNeedLinkConfigs: LinkServiceConfig<S>[] = [];

  constructor () {
    this.setTypesValue();
    this.setAsyncTypesValue();
  }

  @inject(tokens.RxStoreConfig)
  @optional()
  private _storeConfig?: RxStoreConfig;

  public get storeConfig (): RxStoreConfig {
    const configLinkService = this._storeConfig ? this._storeConfig.linkService : {};
    return {
      linkService: {
        dataSelector: payload => payload,
        errorSelector: payload => payload,
        ...configLinkService,
      },
    };
  }

  public init (options: RxStoreInitOptions<S>) {
    this.options = options;
    const {linkService: configLinkService} = this.storeConfig;

    const reducer = (state: S, action: Action) => {
      for (const config of this.serviceNeedLinkConfigs) {
        const {state: stateKey, type: asyncType, dataSelector, errorSelector} = config;

        const finalDataSelector = dataSelector || configLinkService!.dataSelector!;
        const finalErrorSelector = errorSelector || configLinkService!.errorSelector!;

        const {type, payload} = action;

        switch (type) {
          case asyncType.START:
          case asyncType.END:
          case asyncType.ERR: {
            const asyncState = {...(state[stateKey] as any)} as AsyncState;

            switch (type) {
              case asyncType.START: {
                asyncState.loading = true;
                asyncState.err = null;
                break;
              }
              case asyncType.END: {
                asyncState.loading = false;
                asyncState.data = finalDataSelector(payload);
                break;
              }
              case asyncType.ERR: {
                asyncState.loading = false;
                asyncState.err = finalErrorSelector(payload);
                break;
              }
            }

            state = {...(state as any), [stateKey]: asyncState} as S;
          }
        }
      }

      return this.options.reducer(state, action);
    };

    this.state$ = this.action$.pipe(
      scan(reducer, this.options.initialState),
      distinctUntilChanged(),
      shareReplay(1),
    );

    const effectNames = Reflect.getMetadata(effectNamesKey, this);
    const effectMethodNames = effectNames ? effectNames.split('|') : [];

    const effects: Array<Observable<Action>> = [];
    for (const name of effectMethodNames) {
      effects.push((this as any)[name]());
    }

    for (const config of this.serviceNeedLinkConfigs) {
      if (isLinkServiceConfig(config)) {
        const {type} = config;
        effects.push(this.action$.pipe(
          ofType(type.START),
          switchMap(({payload}) => config.service(payload).pipe(
            map(res => ({type: type.END, payload: res})),
            catchError((err) => of({type: type.ERR, payload: err})),
          )),
        ));
      } else {
        console.error('invalid service link config:', config);
      }
    }

    const actionWithEffects$ = merge(...effects).pipe(
      tap(action => {
        if (isAction(action)) {
          this.dispatch(action);
        }
      }),
    );

    const withEffect$ = merge(
      this.state$,
      actionWithEffects$,
    );

    this.unsubscriber = withEffect$.subscribe();
    this.dispatch({type: Symbol('@@INIT')});
  }

  protected action = <P = any>(action: Action<P>): DispatchAbleAction<P> => {
    return {
      ...action,
      dispatch: this.dispatch.bind(this, action)
    };
  };

  protected linkService (linkServiceConfig: LinkServiceConfig<S>) {
    this.serviceNeedLinkConfigs.push(linkServiceConfig);
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
