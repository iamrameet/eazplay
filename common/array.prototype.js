import Accessor from "./accessor.js";
import { defineProperties, definePrototypeProperties } from "./util.js";

definePrototypeProperties(Array, {

  accessor: {
    value(index) {
      return new Accessor(
        this,
        instance => instance[index],
        (instance, value) => instance[index] = value
      );
    },
  },

  random: {
    value(emptyValue = undefined) {
      if(this.length === 0) {
        return emptyValue;
      }
      const index = Math.floor(Math.random() * this.length);
      return this[index];
    }
  }

});

defineProperties(Array, {

  at: {
    value(arrayLike, index) {
      let i = 0;
      for(const element of arrayLike) {
        if(i === index) {
          return element;
        }
        i++;
      }
    }
  }

});