import { asyncTypeDefNamesKey, effectNamesKey, typeDefNamesKey } from './metadataKeys';

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
