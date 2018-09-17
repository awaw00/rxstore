rxstore
----

[![Build Status](https://travis-ci.org/awaw00/react-inject-props.svg?branch=master)](https://travis-ci.org/awaw00/rxstore)
[![npm version](https://badge.fury.io/js/%40awaw00%2Frxstore.svg)](https://badge.fury.io/js/%40awaw00%2Frxstore)
[![Dependency Status](https://david-dm.org/awaw00/rxstore.svg)](https://david-dm.org/awaw00/rxstore)

OOP style reactive state manage solution.

OOP风格的响应式状态管理方案。

## 💾 Installation

`npm i @awaw00/rxstore inversify --save`

or

`yarn add @awaw00/rxstore inversify`

you should install the "reflect-metadata" package as well:

`npm i reflect-metadata --save` or `yarn add reflect-metadata`

## 🚀 Features

- ✅ 模块化store
- ✅ 可控的store作用域，Singleton or Transient
- ✅ 依赖注入
- ✅ 使用rx编写响应式代码

## 📋 Table of contents

- [Quick start](#-quick-start)
  - [准备工作](#准备工作)
  - [定义State接口](#定义state接口)
  - [编写Store类](#编写store类)
  - [绑定Store](#绑定store)
  - [使用Store](#使用store)
  - [Counter demo](#counter-demo)
- [Advanced usage](#-advanced-usage)
  - [Link service](#link-service)
  - [注入RxStore配置](#注入rxstore配置)
  - [Store合并](#store合并)
  - [配合react-inject-props使用](#配合react-inject-props使用)
  

## 🚩 Quick start

### 准备工作

下面将以[TypeScript-React-Starter](https://github.com/Microsoft/TypeScript-React-Starter)为起点，简单说明如何使用rxstore。

rxstore的store与store之间是相互独立的，但是**各store发出的action会在同一个“管道”（action流）中进行传输**，在定义store之前，我们需要先配置一个action管道。

在rxstore的底层，各store会通过依赖注入系统注入这个action管道。熟悉inversify的同学应该也了解，我们的项目会包含一个统一处理依赖关系的文件，我们将这个文件定为`src/ioc/index.ts`，然后编写如下代码：

```typescript
import { Container } from 'inversify';
import { Subject } from 'rxjs';
import { Action, tokens } from '@awaw00/rxstore';

const container = new Container();

container.bind(tokens.ActionStream).toConstantValue(new Subject<Action>());

export {
  container
};
```

上面的代码中，初始化了一个Subject作为action的管道，并使用rxstore暴露出来的tokens将其绑定到了container中。

### 定义State接口

新建文件`src/stores/CounterStore.ts`，我们开始进行Store的编写。

编写store的第一步，就是思考store中需要保存什么结构的状态了，然后将其定义为一个state接口：

```typescript
export interface CounterState {
  count: number;
}
```

### 编写Store类

有了状态接口之后，就可以着手编写store的实现了。

首先，定义一个继承于RxStore的类，并将`CounterState`作为泛型参数传入：

```typescript
import { RxStore } from '@awaw00/rxstore';

export interface CounterState {
  count: number;
}

export class CounterStore extends RxStore<CounterState> {
  
}
```

接着，可以为store定义actionType了。

使用rxstore提供的`typeDef`和`asyncTypeDef`装饰器，可以方便又优雅地定义actionType：

```typescript
import { RxStore, typeDef, asyncTypeDef, ActionType, AsyncActionType } from '@awaw00/rxstore';


export class CounterStore extends RxStore<CounterState> {
  @typeDef() public INCREASE!: ActionType;
  @typeDef() public DOUBLE_INCREASE!: ActionType;
  
  @asyncTypeDef() public DOUBLE_ASYNC!: AsyncActionType;
}
```

上面定义了3个type：两个ActionType以及一个AsyncActionType。

在基类RxStore的构造方法中，会对使用了`typeDef`以及`asyncTypeDef`装饰器的字段进行自动赋值，比如`this.INCREASE`会被赋值为`Symbol('INCREASE')`，而`this.DOUBLE_ASYNC`会被赋值为：

```typescript
INCREASE_ASYNC = {
  START: Symbol('DOUBLE_ASYNC/START'),
  END: Symbol('DOUBLE_ASYNC/END'),
  ERR: Symbol('DOUBLE_ASYNC/ERR'),
}
```

然后我们需要使用`this.init`方法，设置store的initialState以及reducer：

```typescript
import { postConstruct } from 'inversify';
...
export class CounterStore extends RxStore<CounterState> {
  @postConstruct()
  private storeInit () {
    this.init({
      initialState: {
        count: 0
      },
      reducer: (state, {type, payload}) => {
        switch (type) {
          case this.INCREASE:
            return {...state, count: state.count + payload};
          default:
            return state;
        }
      },
    });
  }
}
```

> 为什么要使用postConstructor装饰器？  
>
> rxstore使用inversify管理依赖关系，并且在基类RxStore中使用了property inject的方式来注入一些外部依赖（比如action$），在构造方法执行时，inversify并不能为我们准备好这些依赖对象。  
>
> 使用postConstructor可以确保所有依赖都已就绪后再执行store的初始化操作。

最后，还需要为store定义处理副作用的effects，以及action creators：

```typescript
import { effect, ofType } from '@awaw00/rxstore';
import { withLatestFrom, mapTo, of, switchMap } from 'rxjs/operators';

export class CounterStore extends RxStore<CounterState> {
  ...
  public increase = (count: number) => ({
    type: this.INCREASE,
    payload: count,
  });

  public doubleIncrease = () => ({
    type: this.DOUBLE_INCREASE,
  });

  public asyncDouble = (after: number) => ({
    type: this.DOUBLE_ASYNC.START,
    payload: {
      after,
    },
  });


  @effect()
  private onDoubleIncrease () {
    return this.action$.pipe(
      ofType(this.DOUBLE_INCREASE),
      withLatestFrom(this.state$, (action, state) => state.count),
      map((count: number) => this.increase(count)),
    );
  }

  @effect()
  private onAsyncDouble () {
    return this.action$.pipe(
      ofType(this.DOUBLE_ASYNC.START),
      switchMap((action) => of(action).pipe(
        delay(action.payload.after),
        mapTo(this.doubleIncrease()),
      )),
    );
  }
}
```

### 绑定store

完成store的实现之后，不要忘记在container绑定store：

`src/ioc/index.ts`

```typescript
import { CounterStore } from '../stores/CounterStore';
...
container.bind(CounterStore).toSelf().inSingletonScope();
...
```

### 使用store

完成了counter store的编写后，就可以开始获取并使用store了。

新增Counter组件`src/components/Counter.tsx`，并编写如下代码：

```typescript
iimport React from 'react';
 import { CounterState, CounterStore } from '../stores/CounterStore';
 
 interface Props {
   store: CounterStore;
 }
 
 export class Counter extends React.Component<Props, CounterState> {
   private readonly subscription: { unsubscribe: () => any };
 
   constructor (props: Props) {
     super(props);
 
     this.subscription = props.store.state$.subscribe(state => {
       if (this.state) {
         this.setState(state);
       } else {
         this.state = state;
       }
     });
   }
 
   public componentWillUnmount () {
     // 不要忘记移除监听
     this.subscription.unsubscribe();
   }
 
   public increase = () => {
     const {store} = this.props;
     store.dispatch(store.increase(1));
   };
 
   public doubleIncrease = () => {
     const {store} = this.props;
     store.dispatch(store.doubleIncrease());
   };
 
   public asyncDouble = () => {
     const {store} = this.props;
     store.dispatch(store.asyncDouble(2000));
   };
 
   public render () {
     const {count} = this.state;
     return (
       <div>
         <p>Counter: {count}</p>
         <p>
           <button onClick={this.increase}>INCREASE</button>
           <button onClick={this.doubleIncrease}>DOUBLE</button>
           <button onClick={this.asyncDouble}>DOUBLE ASYNC</button>
         </p>
       </div>
     );
   }
 }
```

在`src/App.tsx`中，获取store并传入Counter组件：

```typescript
import * as React from 'react';
import { container } from './ioc';
import { CounterStore } from './stores/CounterStore';
import { Counter } from './components/Counter';

const store = container.get(CounterStore);

class App extends React.Component {
  public render() {
    return (
      <div className="App">
        <Counter store={store}/>
      </div>
    );
  }
}

export default App;
```

启动项目，大功告成！

### Counter demo

查看[在线DEMO](https://awaw00.github.io/rxstore/counter/)，查看[完整代码](https://github.com/awaw00/rxstore/tree/master/examples/counter)。

## 💎 Advanced usage

### Link Service

开发一个web项目，一定少不了与后端数据接口做交互。

通常情况下，我们可以编写一个这样的effect来处理接口请求和响应：

```typescript
interface State {
  dataState: {
    loading: boolean;
    data: any | null;
    err: any | null;
  };
}

@injectable()
class Store extends RxStore<State> {
  @asyncTypeDef() public GET_DATA!: AsyncActionType;
  
  @inject(Service)
  private service: Service;
  
  @postConstruct()
  private storeInit () {
    this.init({
      initialState: {
        dataState: {
          loading: false,
          data: null,
          err: null
        },
      },
      reducer: (state, action) => {
        switch (action.type) {
          case this.GET_DATA.START: {
            return {...state, dataState: {...state.dataState, loading: true}};
          }
          case this.GET_DATA.END: {
            return {...state, dataState: {...state.dataState, loading: false, data: action.payload}};
          }
          case this.GET_DATA.ERR: {
            return {...state, dataState: {...state.dataState, loading: false, err: action.payload}};
          }
          default:
            return state;
        }
      }
    });
  }
  
  @effect()
  private onGetData () {
    return this.action$.pipe(
      ofType(this.GET_DATA.START),
      switchMap((action) => this.service.getData(action.payload).pipe(
        map(res => ({type: this.GET_DATA.END, payload: res})),
        catchError(err => of({type: this.GET_DATA.ERR, payload: err})),
      )),
    );
  }
}
```

上面的代码看起来还ok，通过`this.GET_DATA.START`的action及其带上的payload作为参数发起请求，并且对接口的loading以及error状态都做了处理。

但是如果按这样的写法来构建一个中大型的应用，你一定会抓狂的：数十个接口，每个接口都需要这样几乎没有区别的十几行代码来处理。

为了简化store与接口的对接，基类RxStore提供了一个`linkService`方法，这个方法接受一个`LinkServiceConfig<State>`对象作为参数，其定义为：

```typescript
export interface LinkServiceConfig<S> {
  type: AsyncActionType;
  service: (...args: any[]) => Observable<any>;
  state: keyof S;
  dataSelector?: (payload: any) => any;
  errorSelector?: (payload: any) => any;
}
```

我们试试用它来改写上面的代码：

```typescript
import { AsyncState, getInitialAsyncState } from '@awaw00/rxstore';

interface State {
  dataState: AsyncState;
}

@injectable()
class Store extends RxStore<State> {
  @asyncTypeDef() public GET_DATA!: AsyncActionType;
  
  @inject(Service)
  private service: Service;
  
  @postConstruct()
  private storeInit () {
    this.linkService({
      type: this.GET_DATA,
      service: this.service.getData.bind(this.service),
      state: 'dataState'
    });
    
    this.init({
      initialState: {
        dataState: getInitialAsyncState()
      },
      reducer: (state, action) => {
        return state;
      }
    });
  }
}
```

新代码实现了与旧代码相同的功能，看起来是否清爽了很多呢？_`getInitialAsyncState`方法用于快速构建一个初始的异步状态对象。_

**注意`linkService`方法需要在`init`方法之前调用。**

`LinkStoreConfig`接口中还有两个可选字段：`dataSelector`以及`errorSelector`。

我们可以使用这两个字段来控制如何从异步方法的返回值或者抛出的错误转换成store中AsyncState.data或AsyncState.err。

比如有如下的一个FakeService：

```typescript
@injectable()
export class FakeService {
  public getData () {
    return of({data: {name: 'awaw00', email: 'awaw0618#outlook.com'}}).pipe(delay(1000));
  }
}
```

使用不带dataSelector的linkState后，会在store中保存整个结构为{data: {name: string; email: string}}的返回值。

如果我们只想要保存data字段中的值{name: 'xxx', email: 'xxx'}，就需要指定一个dataSelector：

```typescript
this.linkState({
  type: this.GET_DATA,
  service: this.fakeService.getData.bind(this.fakeService),
  state: 'data',
  dataSelector: payload => payload.data
});
```

errorSelector的用法与dataSelector类似。

此外，我们还可以通过[注入RxStore配置](#注入rxstore配置)来修改默认的dataSelector与errorSelector。

### 注入RxStore配置

RxStore支持在外部注入一些配置来修改某些默认行为。

注入配置的方法：

1. 编写配置

```typescript
import { RxStoreConfig } from '@awaw00/rxstore';

export class CustomRxStoreConfig implements RxStoreConfig {
  
}
```

2. 注入自定义配置

```typescript
...
import { tokens } from '@awaw00/rxstore';
import { CustomRxStoreConfig } from '../configs/CustomRxStoreConfig';

...
container.bind(tokens.RxStoreConfig).to(CustomRxStoreConfig).inSingletonScope();
...
```

可配置项可见`RxStoreConfig`的接口定义：
```typescript
export interface BaseConfigLinkService {
  dataSelector?: (payload: any) => any; // 配置linkService时默认的dataSelector
  errorSelector?: (payload: any) => any; // 配置linkService时默认的errorSelector
}

export interface RxStoreConfig {
  linkService?: BaseConfigLinkService;
}
```

### Store合并

TODO

### 配合react-inject-props使用

TODO
