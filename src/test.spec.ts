import { Container, inject, injectable, postConstruct } from 'inversify';
import {
  Action,
  ActionType,
  AsyncActionType,
  AsyncState,
  asyncTypeDef,
  effect,
  getInitialAsyncState,
  ofType,
  RxStore,
  RxStoreConfig,
  tokens,
  typeDef,
} from './index';
import { expect } from 'chai';
import { combineLatest, concat, forkJoin, merge, Observable, of, Subject, throwError } from 'rxjs';
import { bufferCount, map, mapTo, skip, skipWhile, take, takeUntil, tap, withLatestFrom } from 'rxjs/operators';

describe('Test', () => {
  let rootContainer: Container;
  let action$ = new Subject<Action>();

  beforeEach(() => {
    rootContainer = new Container();
    rootContainer.bind(tokens.ActionStream).toConstantValue(action$);
  });

  afterEach(() => {
  });

  it('Should typeDef and asyncTypeDef work', () => {
    class Store extends RxStore<any> {
      @typeDef() public TYPE!: ActionType;
      @asyncTypeDef() public ASYNC_TYPE!: AsyncActionType;

      public constructor () {
        super();
      }
    }

    const store = new Store();

    expect(store.TYPE).is.not.eq(void 0);
    expect(store.ASYNC_TYPE).is.not.eq(void 0);
    expect(typeof store.TYPE).is.eq('symbol');
    expect(typeof store.ASYNC_TYPE.START).is.eq('symbol');
    expect(typeof store.ASYNC_TYPE.END).is.eq('symbol');
    expect(typeof store.ASYNC_TYPE.END).is.eq('symbol');
  });
  it('Store combination', (done) => {
    interface ChildState {
      name: string;
      age: number;
    }

    interface ParentState {
      parentName: string;
      child: ChildState;
    }

    @injectable()
    class ChildStore extends RxStore<ChildState> {
      @typeDef() public CHANGE_AGE!: ActionType;

      @postConstruct()
      private storeInit () {
        this.init({
          initialState: {
            name: 'child',
            age: 10,
          },
          reducer: (state, action) => {
            switch (action.type) {
              case this.CHANGE_AGE:
                return {...state, age: 20};
            }

            return state;
          },
        });
      }
    }

    @injectable()
    class ParentStore extends RxStore<ParentState> {

      @inject(ChildStore)
      private childStore!: ChildStore;

      @postConstruct()
      private storeInit () {
        this.init({
          initialState: {
            parentName: 'parent',
            child: this.childStore.options.initialState,
          },
          reducer: (state, action) => {
            return state;
          },
        });

        this.state$ = combineLatest(
          this.state$,
          childStore.state$,
        ).pipe(
          map(([thisState, childState]) => {
            return {
              ...thisState,
              child: childState,
            };
          }),
        );
      }
    }

    rootContainer.bind(ChildStore).toSelf().inSingletonScope();
    rootContainer.bind(ParentStore).toSelf().inSingletonScope();

    const childStore = rootContainer.get(ChildStore);
    const parentStore = rootContainer.get(ParentStore);

    (parentStore.state$.pipe(
      skip(1),
    ) as Observable<ParentState>).subscribe(state => {
      expect(state.child.age).to.eq(20);
      done();
    });

    childStore.dispatch({type: childStore.CHANGE_AGE});
  });
  it('Link service', (done) => {
    @injectable()
    class Service {
      public getData () {
        return of(true);
      }

      public getDataWithParams (params: number) {
        return of(params);
      }

      public getDataThrowErr () {
        return throwError(new Error('err'));
      }
    }

    interface StoreState {
      data: AsyncState<{ data: boolean }>;
      dataWithParams: AsyncState<{ data: number }>;
      dataWithError: AsyncState;
    }

    @injectable()
    class Store extends RxStore<StoreState> {
      @asyncTypeDef() public GET_DATA!: AsyncActionType;
      @asyncTypeDef() public GET_DATA_WITH_PARAMS!: AsyncActionType;
      @asyncTypeDef() public GET_DATA_WITH_ERROR!: AsyncActionType;

      @inject(Service)
      private service!: Service;

      @postConstruct()
      private storeInit () {
        this.linkService({
          type: this.GET_DATA,
          service: this.service.getData.bind(this.service),
          state: 'data',
        });

        this.linkService({
          type: this.GET_DATA_WITH_PARAMS,
          service: this.service.getDataWithParams.bind(this.service),
          state: 'dataWithParams',
        });

        this.linkService({
          type: this.GET_DATA_WITH_ERROR,
          service: this.service.getDataThrowErr.bind(this.service),
          state: 'dataWithError',
        });

        this.init({
          initialState: {
            data: getInitialAsyncState(),
            dataWithParams: getInitialAsyncState(),
            dataWithError: getInitialAsyncState(),
          },
          reducer: (state, action) => {
            return state;
          },
        });
      }
    }

    rootContainer.bind(Service).toSelf().inSingletonScope();
    rootContainer.bind(Store).toSelf().inSingletonScope();

    const store = rootContainer.get(Store);

    (store.state$.pipe(
      skip(6),
      take(1),
    ) as Observable<StoreState>).subscribe(state => {
      expect(state.data.loading).is.eq(false);
      expect(state.data.err).is.eq(null);
      expect(state.data.data).is.eq(true);
      expect(state.dataWithParams.loading).is.eq(false);
      expect(state.dataWithParams.err).is.eq(null);
      expect(state.dataWithParams.data).is.eq(2);
      expect(state.dataWithError.loading).is.eq(false);
      expect(state.dataWithError.err!.message).is.eq('err');
      expect(state.dataWithError.data).is.eq(null);
      done();
    });

    store.dispatch({type: store.GET_DATA.START});
    store.dispatch({type: store.GET_DATA_WITH_PARAMS.START, payload: 2});
    store.dispatch({type: store.GET_DATA_WITH_ERROR.START});
  });
  it('Custom linkService dataSelector and errorSelector', (done) => {
    @injectable()
    class StoreConfig implements RxStoreConfig {
      public get linkService () {
        return {
          dataSelector: (payload: any) => payload.data,
          errorSelector: (payload: any) => payload.message,
        };
      }
    }

    rootContainer.bind(tokens.RxStoreConfig).to(StoreConfig).inSingletonScope();

    @injectable()
    class Service {
      public getDataWithParams (params: number) {
        return of({data: params});
      }

      public getDataThrowErr () {
        return throwError(new Error('err'));
      }

      public getDataWithCustomDataSelector () {
        return of({data: {data: 123}});
      }

      public getDataWithCustomErrorSelector () {
        class CustomError extends Error {
          constructor (public test: string) {
            super('test');
          }
        }

        return throwError(new CustomError('aaa'));
      }
    }

    interface StoreState {
      dataWithParams: AsyncState<{ data: number }>;
      dataWithError: AsyncState;
      dataWithCustomDataSelector: AsyncState<{ data: { data: number } }>;
      dataWithCustomErrorSelector: AsyncState;
    }

    @injectable()
    class Store extends RxStore<StoreState> {
      @asyncTypeDef() public GET_DATA_WITH_PARAMS!: AsyncActionType;
      @asyncTypeDef() public GET_DATA_WITH_ERROR!: AsyncActionType;
      @asyncTypeDef() public GET_DATA_WITH_CUSTOM_DATA_SELECTOR!: AsyncActionType;
      @asyncTypeDef() public GET_DATA_WITH_CUSTOM_ERR_SELECTOR!: AsyncActionType;

      @inject(Service)
      private service!: Service;

      @postConstruct()
      private storeInit () {
        this.linkService({
          type: this.GET_DATA_WITH_PARAMS,
          service: this.service.getDataWithParams.bind(this.service),
          state: 'dataWithParams',
        });

        this.linkService({
          type: this.GET_DATA_WITH_ERROR,
          service: this.service.getDataThrowErr.bind(this.service),
          state: 'dataWithError',
        });

        this.linkService({
          type: this.GET_DATA_WITH_CUSTOM_DATA_SELECTOR,
          service: this.service.getDataWithCustomDataSelector.bind(this.service),
          state: 'dataWithCustomDataSelector',
          dataSelector: (payload: any) => payload.data.data,
        });

        this.linkService({
          type: this.GET_DATA_WITH_CUSTOM_ERR_SELECTOR,
          service: this.service.getDataWithCustomErrorSelector.bind(this.service),
          state: 'dataWithCustomErrorSelector',
          errorSelector: (payload: any) => payload.test,
        });

        this.init({
          initialState: {
            dataWithParams: getInitialAsyncState(),
            dataWithError: getInitialAsyncState(),
            dataWithCustomDataSelector: getInitialAsyncState(),
            dataWithCustomErrorSelector: getInitialAsyncState(),
          },
          reducer: (state, action) => {
            return state;
          },
        });
      }
    }

    rootContainer.bind(Service).toSelf().inSingletonScope();
    rootContainer.bind(Store).toSelf().inSingletonScope();

    const store = rootContainer.get(Store);

    (store.state$.pipe(
      skip(8),
      take(1),
    ) as Observable<StoreState>).subscribe(state => {
      expect(state.dataWithParams.loading).is.eq(false);
      expect(state.dataWithParams.err).is.eq(null);
      expect(state.dataWithParams.data).is.eq(2);
      expect(state.dataWithError.loading).is.eq(false);
      expect(state.dataWithError.err).is.eq('err');
      expect(state.dataWithError.data).is.eq(null);
      expect(state.dataWithCustomDataSelector.loading).is.eq(false);
      expect(state.dataWithCustomDataSelector.data).is.eq(123);
      expect(state.dataWithCustomDataSelector.err).is.eq(null);
      expect(state.dataWithCustomErrorSelector.loading).is.eq(false);
      expect(state.dataWithCustomErrorSelector.err).is.eq('aaa');
      expect(state.dataWithCustomErrorSelector.data).is.eq(null);
      done();
    });

    store.dispatch({type: store.GET_DATA_WITH_PARAMS.START, payload: 2});
    store.dispatch({type: store.GET_DATA_WITH_ERROR.START});
    store.dispatch({type: store.GET_DATA_WITH_CUSTOM_DATA_SELECTOR.START});
    store.dispatch({type: store.GET_DATA_WITH_CUSTOM_ERR_SELECTOR.START});
  });

  it('Epic action', (done) => {
    interface State {
      loopCount: number;
    }

    @injectable()
    class Store extends RxStore<State> {
      @typeDef() public LOOP!: ActionType;
      @typeDef() public PING!: ActionType;
      @typeDef() public PONG!: ActionType;

      @postConstruct()
      private storeInit () {
        this.init({
          initialState: {
            loopCount: 0,
          },
          reducer: (state, action) => {
            switch (action.type) {
              case this.LOOP:
                return {...state, loopCount: state.loopCount + 1};
            }
            return state;
          },
        });
      }

      @effect()
      private onLoop () {
        return this.action$.pipe(
          ofType(this.LOOP),
          takeUntil(this.state$.pipe(
            skipWhile(state => state.loopCount < 11),
          )),
        );
      }

      @effect()
      private onPing () {
        return this.action$.pipe(
          ofType(this.PING),
          mapTo({type: this.PONG}),
        );
      }
    }

    const store = rootContainer.resolve(Store);

    forkJoin(
      concat(
        action$.pipe(
          ofType(store.LOOP),
          bufferCount(10),
          take(1),
        ),
        merge(
          action$.pipe(
            ofType(store.PONG),
            take(1),
          ),
          of(0).pipe(tap(() => {
            store.dispatch({type: store.PING});
          })),
        ),
      ),
    ).subscribe(() => {
      done();
    });

    store.dispatch({type: store.LOOP});
  });
  it('Should state update before subscribed', (done) => {
    interface State {
      count: number;
    }

    @injectable()
    class Store extends RxStore<State> {
      @typeDef() public INCREASE!: ActionType;
      @typeDef() public DOUBLE!: ActionType;

      @postConstruct()
      private storeInit () {
        this.init({
          initialState: {
            count: 0,
          },
          reducer: (state, action) => {
            switch (action.type) {
              case this.INCREASE:
                return {...state, count: state.count + action.payload};
            }
            return state;
          },
        });
      }

      @effect()
      private onDouble () {
        return this.action$.pipe(
          ofType(this.DOUBLE),
          withLatestFrom(this.state$, (action, state) => state.count),
          map(count => ({type: this.INCREASE, payload: count})),
        );
      }
    }

    const store = rootContainer.resolve(Store);

    store.dispatch({type: store.INCREASE, payload: 1});
    store.dispatch({type: store.DOUBLE});

    store.state$.pipe(take(1)).subscribe(state => {
      expect(state.count).is.eq(2);
      done();
    });
  });
  it('Should combined state update before subscribed', (done) => {
    interface State {
      count: number;
    }

    @injectable()
    class CounterStore extends RxStore<State> {
      @typeDef() public INCREASE!: ActionType;
      @typeDef() public DOUBLE!: ActionType;

      @postConstruct()
      private storeInit () {
        this.init({
          initialState: {
            count: 0,
          },
          reducer: (state, action) => {
            if (action.type === this.INCREASE) {
              return {...state, count: state.count + 1};
            }
            return state;
          },
        });
      }

    }

    @injectable()
    class CombinedStore extends RxStore<State> {
      @inject(CounterStore)
      public counterStore!: CounterStore;

      @postConstruct()
      private storeInit () {
        this.init({
          initialState: {
            count: this.counterStore!.options.initialState.count,
          },
          reducer: state => state,
        });

        this.state$ = combineLatest(
          this.state$,
          this.counterStore!.state$,
        ).pipe(
          map(([selfState, counterState]) => ({
            count: counterState.count,
          })),
        );
      }
    }

    rootContainer.bind(CounterStore).toSelf().inSingletonScope();
    const store = rootContainer.resolve(CombinedStore);

    store.counterStore.dispatch({type: store.counterStore.INCREASE});

    store.state$.pipe(take(1)).subscribe(state => {
      expect(state.count).is.eq(1);
      done();
    });
  });
});
