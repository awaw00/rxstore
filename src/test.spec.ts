import { Container, inject, injectable, postConstruct } from 'inversify';
import {
  Action,
  ActionStream,
  ActionType,
  AsyncActionType,
  AsyncState,
  asyncTypeDef,
  getInitialAsyncState,
  RxStore,
  typeDef,
} from './index';
import { expect } from 'chai';
import { combineLatest, Observable, of, Subject } from 'rxjs';
import { delay, map, skip, take } from 'rxjs/operators';

describe('Test', () => {
  let rootContainer: Container;
  let action$ = new Subject<Action>();

  beforeEach(() => {
    rootContainer = new Container();
    rootContainer.bind(ActionStream).toConstantValue(action$);
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
        return of(true).pipe(delay(10));
      }

      public getDataWithParams (params: number) {
        return of(params).pipe(delay(10));
      }
    }

    interface StoreState {
      data: AsyncState<{ data: boolean }>;
      dataWithParams: AsyncState<{ data: number }>;
    }

    @injectable()
    class Store extends RxStore<StoreState> {
      @asyncTypeDef() public GET_DATA!: AsyncActionType;
      @asyncTypeDef() public GET_DATA_WITH_PARAMS!: AsyncActionType;

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

        this.init({
          initialState: {
            data: getInitialAsyncState(),
            dataWithParams: getInitialAsyncState(),
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
      skip(4),
      take(1),
    ) as Observable<StoreState>).subscribe(state => {
      expect(state.data.loading).is.eq(false);
      expect(state.data.err).is.eq(null);
      expect(state.data.data).is.eq(true);
      expect(state.dataWithParams.loading).is.eq(false);
      expect(state.dataWithParams.err).is.eq(null);
      expect(state.dataWithParams.data).is.eq(2);
      done();
    });

    store.dispatch({type: store.GET_DATA.START});
    store.dispatch({type: store.GET_DATA_WITH_PARAMS.START, payload: 2});
  });
});
