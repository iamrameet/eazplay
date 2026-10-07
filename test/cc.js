const statement = /** @type {[ type: "debit" | "credit", name: string, amount: number[], user: string ][]} */ ([
    [ "debit", "riot", [ 1660, 16.6, 2.99], "R" ],
    [ "debit", "bookmyshow", [ 1 ], "R" ],
    [ "debit", "renewal fee", [ 500, 90 ], "R" ],
    // [ "credit", "bank transfer", [ 2746 ], "R" ],
    [ "debit", "flipkart", [ 236 ], "R" ],
    [ "debit", "offus", [ 52147 ], "A" ],
    [ "debit", "riot", [ 1660, 16.6, 2.99], "R" ],
    [ "credit", "offus", [ 52147 ], "A" ],
    [ "debit", "offus processing fee", [ 299, 53.82 ], "A" ],
    [ "credit", "bank transfer", [ 5000 ], "R" ],
    [ "debit", "flipkart", [ 13798 ], "P" ],
    [ "debit", "offus emi", [ 4036.05, 903.82 ], "A" ],
  ]);

/**
 * @template K
 * @template V
 * @extends {Map<K, V>}
*/
class CMap extends Map {
  /**
   * @param {K} key
   * @param {(value: V) => V} setter
  */
  setWith(key, setter) {
    this.set(key, setter(this.get(key)));
    return this;
  }
}

let netAmount = 0, debitAmount = 0, creditAmount = 0;
/** @type {CMap<string, number>} */
let netAmountMap = new CMap;

for(const [ type, _name, transaction, user ] of statement) {
  if(!netAmountMap.has(user)) {
    netAmountMap.set(user, 0);
  }
  for(const amount of transaction) {
    if(type === "debit") {
      netAmount += amount;
      netAmountMap.setWith(user, value => value + amount);
      debitAmount += amount;
    } else {
      netAmount -= amount;
      netAmountMap.setWith(user, value => value - amount);
      creditAmount += amount;
    }
    console.log(user, type, amount);
    console.log("balance", netAmount);
    console.log(user, "balance", netAmountMap.get(user));
    console.log("--------------------------------");
  }
}