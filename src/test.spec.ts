import { RxStore, typeDef, asyncTypeDef, AsyncActionType, ActionType } from './index';
import { expect } from 'chai';
import { postConstruct } from 'inversify';

describe('Test', () => {
  it('Should typeDef and asyncTypeDef work', () => {
    class Store extends RxStore<any> {
      @typeDef public TYPE!: ActionType;
      @asyncTypeDef public ASYNC_TYPE!: AsyncActionType;

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
});
