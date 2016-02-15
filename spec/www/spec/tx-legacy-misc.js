/* 'use strict'; */

var MYTIMEOUT = 12000;

var DEFAULT_SIZE = 5000000; // max to avoid popup in safari/ios

// FUTURE TODO replace in test(s):
function ok(test, desc) { expect(test).toBe(true); }
function equal(a, b, desc) { expect(a).toEqual(b); } // '=='
function strictEqual(a, b, desc) { expect(a).toBe(b); } // '==='

// XXX TODO REFACTOR OUT OF OLD TESTS:
var wait = 0;
var test_it_done = null;
function xtest_it(desc, fun) { xit(desc, fun); }
function test_it(desc, fun) {
  wait = 0;
  it(desc, function(done) {
    test_it_done = done;
    fun();
  }, MYTIMEOUT);
}
function stop(n) {
  if (!!n) wait += n
  else ++wait;
}
function start(n) {
  if (!!n) wait -= n;
  else --wait;
  if (wait == 0) test_it_done();
}

var isAndroid = /Android/.test(navigator.userAgent);
var isWP8 = /IEMobile/.test(navigator.userAgent); // Matches WP(7/8/8.1)
//var isWindows = /Windows NT/.test(navigator.userAgent); // Windows [NT] (8.1)
var isWindows = /Windows /.test(navigator.userAgent); // Windows (8.1)
//var isWindowsPC = /Windows NT/.test(navigator.userAgent); // Windows [NT] (8.1)
//var isWindowsPhone_8_1 = /Windows Phone 8.1/.test(navigator.userAgent); // Windows Phone 8.1
//var isIE = isWindows || isWP8 || isWindowsPhone_8_1;
var isIE = isWindows || isWP8;
var isWebKit = !isIE; // TBD [Android or iOS]

// NOTE: In the core-master branch there is no difference between the default
// implementation and implementation #2. But the test will also apply
// the androidLockWorkaround: 1 option in the case of implementation #2.
var scenarioList = [
  isAndroid ? 'Plugin-implementation-default' : 'Plugin',
  'HTML5',
  'Plugin-implementation-2'
];

var scenarioCount = (!!window.hasWebKitBrowser) ? (isAndroid ? 3 : 2) : 1;

var mytests = function() {

  for (var i=0; i<scenarioCount; ++i) {

    describe(scenarioList[i] + ': misc legacy tx test(s)', function() {
      var scenarioName = scenarioList[i];
      var suiteName = scenarioName + ': ';
      var isWebSql = (i === 1);
      var isOldImpl = (i === 2);

      // NOTE: MUST be defined in function scope, NOT outer scope:
      var openDatabase = function(name, ignored1, ignored2, ignored3) {
        if (isOldImpl) {
          return window.sqlitePlugin.openDatabase({
            // prevent reuse of database from default db implementation:
            name: 'i2-'+name,
            androidDatabaseImplementation: 2,
            androidLockWorkaround: 1
          });
        }
        if (isWebSql) {
          return window.openDatabase(name, "1.0", "Demo", DEFAULT_SIZE);
        } else {
          return window.sqlitePlugin.openDatabase(name, "1.0", "Demo", DEFAULT_SIZE);
        }
      }

      describe(suiteName + 'legacy transaction columns semantics test(s)', function() {

        // FUTURE TODO: fix these tests to follow the Jasmine style and move into a separate spec file:

        function withTestTable(func) {
          //stop();
          var db = openDatabase("Database", "1.0", "Demo", DEFAULT_SIZE);
          db.transaction(function(tx) {
            tx.executeSql('DROP TABLE IF EXISTS test_table');
            tx.executeSql('CREATE TABLE IF NOT EXISTS test_table (id integer primary key, data text, data_num integer)');
          }, function(err) { ok(false, err.message) }, function() {
            //start();
            func(db);
          });
        };

        test_it(suiteName + "all columns should be included in result set (including 'null' columns)", function() {
          withTestTable(function(db) {
            stop();
            db.transaction(function(tx) {
              tx.executeSql("insert into test_table (data, data_num) VALUES (?,?)", ["test", null], function(tx, res) {
                expect(res).toBeDefined();
                //if (!isWindows) // XXX TODO
                  expect(res.rowsAffected).toEqual(1);
                tx.executeSql("select * from test_table", [], function(tx, res) {
                  var row = res.rows.item(0);
                  //deepEqual(row, { id: 1, data: "test", data_num: null }, "all columns should be included in result set.");
                  expect(row.id).toBe(1);
                  expect(row.data).toEqual('test');
                  expect(row.data_num).toBeDefined();
                  expect(row.data_num).toBeNull();

                  start();
                });
              });
            });
          });
        });

      });

      describe(scenarioList[i] + ': tx insertion test(s)', function() {

        test_it(suiteName + "number values inserted using number bindings", function() {
          stop();
          var db = openDatabase("Value-binding-test.db", "1.0", "Demo", DEFAULT_SIZE);
          db.transaction(function(tx) {
            tx.executeSql('DROP TABLE IF EXISTS test_table');
            tx.executeSql('CREATE TABLE IF NOT EXISTS test_table (id integer primary key, data_text1, data_text2, data_int, data_real)');
          }, function(err) { ok(false, err.message) }, function() {
            db.transaction(function(tx) {
              // create columns with no type affinity
              tx.executeSql("insert into test_table (data_text1, data_text2, data_int, data_real) VALUES (?,?,?,?)", ["314159", "3.14159", 314159, 3.14159], function(tx, res) {
                expect(res).toBeDefined();
                //if (!isWindows) // XXX TODO
                  expect(res.rowsAffected).toBe(1);

                tx.executeSql("select * from test_table", [], function(tx, res) {
                  var row = res.rows.item(0);
                  strictEqual(row.data_text1, "314159", "data_text1 should have inserted data as text");
                  if (!isWP8) // JSON issue in WP(8) version
                    strictEqual(row.data_text2, "3.14159", "data_text2 should have inserted data as text");
                  strictEqual(row.data_int, 314159, "data_int should have inserted data as an integer");
                  ok(Math.abs(row.data_real - 3.14159) < 0.000001, "data_real should have inserted data as a real");

                  start();
                });
              });
            });
          });
        });

        test_it(suiteName + "Big [integer] value bindings", function() {
          if (isWP8) pending('BROKEN for WP(8)'); // XXX [BUG #195]

          stop();

          var db = openDatabase("Big-int-bindings.db", "1.0", "Demo", DEFAULT_SIZE);
          db.transaction(function(tx) {
            tx.executeSql('DROP TABLE IF EXISTS tt');
            tx.executeSql('CREATE TABLE IF NOT EXISTS tt (test_date INTEGER, test_text TEXT)');
          }, function(err) { ok(false, err.message) }, function() {
            db.transaction(function(tx) {
              tx.executeSql("insert into tt (test_date, test_text) VALUES (?,?)",
                  [1424174959894, 1424174959894], function(tx, res) {
                expect(res).toBeDefined();
                expect(res.rowsAffected).toBe(1);
                tx.executeSql("select * from tt", [], function(tx, res) {
                  var row = res.rows.item(0);
                  strictEqual(row.test_date, 1424174959894, "Big integer number inserted properly");

                  // NOTE: storing big integer in TEXT field WORKING OK with WP(8) version.
                  // It is now suspected that the issue lies with the results handling.
                  // XXX Brody TODO: storing big number in TEXT field is different for Plugin vs. Web SQL!
                  if (isWebSql)
                    strictEqual(row.test_text, "1424174959894.0", "[Big] number inserted as string ok");
                  else
                    strictEqual(row.test_text, "1424174959894", "Big integer number inserted as string ok");

                  start();
                });
              });
            });
          });
        });

        test_it(suiteName + "Double precision decimal number insertion", function() {
          stop();
          var db = openDatabase("Double-precision-number-insertion.db", "1.0", "Demo", DEFAULT_SIZE);
          db.transaction(function(tx) {
            tx.executeSql('DROP TABLE IF EXISTS tt');
            tx.executeSql('CREATE TABLE IF NOT EXISTS tt (tr REAL)');
          }, function(err) { ok(false, err.message) }, function() {
            db.transaction(function(tx) {
              tx.executeSql("insert into tt (tr) VALUES (?)", [123456.789], function(tx, res) {
                expect(res).toBeDefined();
                //if (!isWindows) // XXX TODO
                  expect(res.rowsAffected).toBe(1);
                tx.executeSql("select * from tt", [], function(tx, res) {
                  var row = res.rows.item(0);
                  strictEqual(row.tr, 123456.789, "Decimal number inserted properly");

                  start();
                });
              });
            });
          });
        });

        test_it(suiteName + "executeSql parameter as array", function() {
          stop();
          var db = openDatabase("array-parameter.db", "1.0", "Demo", DEFAULT_SIZE);
          db.transaction(function(tx) {
            tx.executeSql('DROP TABLE IF EXISTS test_table');
            tx.executeSql('CREATE TABLE IF NOT EXISTS test_table (id integer primary key, data1, data2)');
          }, function(err) { ok(false, err.message) }, function() {
            db.transaction(function(tx) {
              // create columns with no type affinity
              tx.executeSql("insert into test_table (data1, data2) VALUES (?,?)", ['abc', [1,2,3]], function(tx, res) {
                expect(res).toBeDefined();
                //if (!isWindows) // XXX TODO
                  expect(res.rowsAffected).toBe(1);
                tx.executeSql("select * from test_table", [], function(tx, res) {
                  var row = res.rows.item(0);
                  strictEqual(row.data1, 'abc', "data1: string");
                  strictEqual(row.data2, '1,2,3', "data2: array should have been inserted as text (string)");

                  start();
                });
              });
            });
          });
        });

        // XXX TBD skip for now:
        // This test shows that the plugin does not throw an error when trying to serialize
        // a non-standard parameter type. Blob becomes an empty dictionary on iOS, for example,
        // and so this verifies the type is converted to a string and continues. Web SQL does
        // the same but on the JavaScript side and converts to a string like `[object Blob]`.
        xtest_it(suiteName + "INSERT Blob from ArrayBuffer (non-standard parameter type)", function() {
          if (isWindows) pending('BROKEN for Windows'); // XXX (??)
          if (isWP8) pending('BROKEN for WP(8)'); // (???)
          if (typeof Blob === "undefined") pending('Blob type does not exist');
          if (/Android [1-4]/.test(navigator.userAgent)) pending('BROKEN for Android [version 1.x-4.x]');

          // abort the test if ArrayBuffer is undefined
          // TODO: consider trying this for multiple non-standard parameter types instead
          if (typeof ArrayBuffer === "undefined") pending('ArrayBuffer type does not exist');


          var db = openDatabase("Blob-test.db", "1.0", "Demo", DEFAULT_SIZE);
          ok(!!db, "db object");
          stop(1);

          db.transaction(function(tx) {
            ok(!!tx, "tx object");
            stop(1);

            var buffer = new ArrayBuffer(5);
            var view   = new Uint8Array(buffer);
            view[0] = 'h'.charCodeAt();
            view[1] = 'e'.charCodeAt();
            view[2] = 'l'.charCodeAt();
            view[3] = 'l'.charCodeAt();
            view[4] = 'o'.charCodeAt();
            var blob = new Blob([view.buffer], { type:"application/octet-stream" });

            tx.executeSql('DROP TABLE IF EXISTS test_table');
            tx.executeSql('CREATE TABLE IF NOT EXISTS test_table (foo blob)');
            tx.executeSql('INSERT INTO test_table VALUES (?)', [blob], function(tx, res) {
              ok(true, "INSERT blob OK");
              start(1);
            }, function(tx, error) {
              ok(false, "INSERT blob FAILED");
              start(1);
            });
            start(1);
          }, function(err) { 
            ok(false, "transaction failure with message: " + err.message);
            start(1);
          });
        });

        test_it(suiteName + ' stores [Unicode] string with \\u0000 correctly', function () {
          if (isWindows) pending('BROKEN on Windows'); // XXX
          if (isWP8) pending('BROKEN for WP(8)'); // [BUG #202] UNICODE characters not working with WP(8)
          if (isAndroid && !isWebSql && !isOldImpl) pending('BROKEN for Android (default sqlite-connector version)'); // XXX

          stop();

          var dbName = "Database-Unicode";
          var db = openDatabase(dbName, "1.0", "Demo", DEFAULT_SIZE);

          db.transaction(function (tx) {
            tx.executeSql('DROP TABLE IF EXISTS test', [], function () {
              tx.executeSql('CREATE TABLE test (name, id)', [], function() {
                tx.executeSql('INSERT INTO test VALUES (?, "id1")', ['\u0000foo'], function () {
                  tx.executeSql('SELECT hex(name) AS `hex` FROM test', [], function (tx, res) {
                    // select hex() because even the native database doesn't
                    // give the full string. it's a bug in WebKit apparently
                    var hex = res.rows.item(0).hex;

                    // varies between Chrome-like (UTF-8)
                    // and Safari-like (UTF-16)
                    var expected = [
                      '000066006F006F00',
                      '00666F6F'
                    ];
                    ok(expected.indexOf(hex) !== -1, 'hex matches: ' +
                        JSON.stringify(hex) + ' should be in ' +
                        JSON.stringify(expected));

                    // ensure this matches our expectation of that database's
                    // default encoding
                    tx.executeSql('SELECT hex("foob") AS `hex`', [], function (tx, res) {
                      var otherHex = res.rows.item(0).hex;
                      equal(hex.length, otherHex.length,
                          'expect same length, i.e. same global db encoding');

                      checkCorrectOrdering(tx);
                    });
                  })
                });
              });
            });
          }, function(err) {
            ok(false, 'unexpected error: ' + err.message);
          }, function () {
          });
        });

        function checkCorrectOrdering(tx) {
          var least = "54key3\u0000\u0000";
          var most = "54key3\u00006\u0000\u0000";
          var key1 = "54key3\u00004bar\u000031\u0000\u0000";
          var key2 = "54key3\u00004foo\u000031\u0000\u0000";

          tx.executeSql('INSERT INTO test VALUES (?, "id2")', [key1], function () {
            tx.executeSql('INSERT INTO test VALUES (?, "id3")', [key2], function () {
              var sql = 'SELECT id FROM test WHERE name > ? AND name < ? ORDER BY name';
              tx.executeSql(sql, [least, most], function (tx, res) {
                equal(res.rows.length, 2, 'should get two results');
                equal(res.rows.item(0).id, 'id2', 'correct ordering');
                equal(res.rows.item(1).id, 'id3', 'correct ordering');

                start();
              });
            });
          });
        }

        test_it(suiteName + ' returns [Unicode] string with \\u0000 correctly', function () {
          if (isWindows) pending('BROKEN on Windows'); // XXX
          if (isWP8) pending('BROKEN for WP(8)'); // [BUG #202] UNICODE characters not working with WP(8)

          stop();

          var dbName = "Database-Unicode";
          var db = openDatabase(dbName, "1.0", "Demo", DEFAULT_SIZE);

          db.transaction(function (tx) {
            tx.executeSql('DROP TABLE IF EXISTS test', [], function () {
              tx.executeSql('CREATE TABLE test (name, id)', [], function() {
                tx.executeSql('INSERT INTO test VALUES (?, "id1")', ['\u0000foo'], function () {
                  tx.executeSql('SELECT name FROM test', [], function (tx, res) {
                    var name = res.rows.item(0).name;

                    var expected = [
                      '\u0000foo'
                    ];

                    // There is a bug in WebKit and Chromium where strings are created
                    // using methods that rely on '\0' for termination instead of
                    // the specified byte length.
                    //
                    // https://bugs.webkit.org/show_bug.cgi?id=137637
                    //
                    // For now we expect this test to fail there, but when it is fixed
                    // we would like to know, so the test is coded to fail if it starts
                    // working there.
                    if(isWebSql) {
                        ok(expected.indexOf(name) === -1, 'field value: ' +
                            JSON.stringify(name) + ' should not be in this until a bug is fixed ' +
                            JSON.stringify(expected));

                        equal(name.length, 0, 'length of field === 0'); 
                        start();
                        return;
                    }

                    // correct result:
                    ok(expected.indexOf(name) !== -1, 'field value: ' +
                        JSON.stringify(name) + ' should be in ' +
                        JSON.stringify(expected));

                    equal(name.length, 4, 'length of field === 4');
                    start();
                  })
                });
              });
            });
          }, function(err) {
            ok(false, 'unexpected error: ' + err.message);
          }, function () {
          });
        });

        // XXX Brody NOTE: same issue is now reproduced in a string test.
        //           TBD ???: combine with other test
        // BUG #147 iOS version of plugin BROKEN:
        test_it(suiteName +
            ' handles UNICODE \\u2028 line separator correctly [in database]', function () {
          if (isWP8) pending('BROKEN for WP(8)'); // [BUG #202] UNICODE characters not working with WP(8)
          if (!(isWebSql || isAndroid || isIE)) pending('BROKEN for iOS'); // XXX [BUG #147] (no callback received)

          var dbName = "Unicode-line-separator.db";
          var db = openDatabase(dbName, "1.0", "Demo", DEFAULT_SIZE);

          stop(2);

          db.transaction(function (tx) {
            tx.executeSql('DROP TABLE IF EXISTS test', [], function () {
              tx.executeSql('CREATE TABLE test (name, id)', [], function() {
                tx.executeSql('INSERT INTO test VALUES (?, "id1")', ['hello\u2028world'], function () {
                  tx.executeSql('SELECT name FROM test', [], function (tx, res) {
                    var name = res.rows.item(0).name;

                    var expected = [
                      'hello\u2028world'
                    ];

                    ok(expected.indexOf(name) !== -1, 'field value: ' +
                       JSON.stringify(name) + ' should be in ' +
                       JSON.stringify(expected));

                    equal(name.length, 11, 'length of field should be 15');
                    start();
                  })
                });
              });
            });
          }, function(err) {
            ok(false, 'unexpected error: ' + err.message);
            start(2);
          }, function () {
            ok(true, 'transaction ok');
            start();
          });
        });

      });

      describe(scenarioList[i] + ': error mapping test(s)', function() {

        test_it(suiteName + "syntax error", function() {
          var db = openDatabase("Syntax-error-test.db", "1.0", "Demo", DEFAULT_SIZE);
          ok(!!db, "db object");

          stop(2);
          db.transaction(function(tx) {
            tx.executeSql('DROP TABLE IF EXISTS test_table');
            tx.executeSql('CREATE TABLE IF NOT EXISTS test_table (data unique)');

            // This insertion has a sql syntax error
            tx.executeSql("insert into test_table (data) VALUES ", [123], function(tx) {
              ok(false, "unexpected success");
              start();
              throw new Error('abort tx');
            }, function(tx, error) {
              ok(!!error, "valid error object");

              // XXX ONLY WORKING for iOS version of plugin:
              if (isWebSql || !(isAndroid || isWindows || isWP8))
                ok(!!error['code'], "valid error.code exists");

              ok(error.hasOwnProperty('message'), "error.message exists");
              // XXX ONLY WORKING for iOS version of plugin:
              if (isWebSql || !(isAndroid || isWindows || isWP8))
                strictEqual(error.code, 5, "error.code === SQLException.SYNTAX_ERR (5)");
              //equal(error.message, "Request failed: insert into test_table (data) VALUES ,123", "error.message");
              start();

              // We want this error to fail the entire transaction
              return true;
            });
          }, function (error) {
            ok(!!error, "valid error object");
            ok(error.hasOwnProperty('message'), "error.message exists");
            start();
          });
        });

        test_it(suiteName + "constraint violation", function() {
          if (isWindows) pending('BROKEN for Windows'); // XXX TODO
          //if (isWindowsPhone_8_1) pending('BROKEN for Windows Phone 8.1'); // XXX TODO

          var db = openDatabase("Constraint-violation-test.db", "1.0", "Demo", DEFAULT_SIZE);
          ok(!!db, "db object");

          stop(2);
          db.transaction(function(tx) {
            tx.executeSql('DROP TABLE IF EXISTS test_table');
            tx.executeSql('CREATE TABLE IF NOT EXISTS test_table (data unique)');

            tx.executeSql("insert into test_table (data) VALUES (?)", [123], null, function(tx, error) {
              ok(false, error.message);
            });

            // This insertion will violate the unique constraint
            tx.executeSql("insert into test_table (data) VALUES (?)", [123], function(tx) {
              ok(false, "unexpected success");
              ok(!!res['rowsAffected'] || !(res.rowsAffected >= 1), "should not have positive rowsAffected");
              start();
              throw new Error('abort tx');
            }, function(tx, error) {
              ok(!!error, "valid error object");

              // XXX ONLY WORKING for iOS version of plugin:
              if (isWebSql || !(isAndroid || isWindows || isWP8))
                ok(!!error['code'], "valid error.code exists");

              ok(error.hasOwnProperty('message'), "error.message exists");
              //strictEqual(error.code, 6, "error.code === SQLException.CONSTRAINT_ERR (6)");
              //equal(error.message, "Request failed: insert into test_table (data) VALUES (?),123", "error.message");
              start();

              // We want this error to fail the entire transaction
              return true;
            });
          }, function(error) {
            ok(!!error, "valid error object");
            ok(error.hasOwnProperty('message'), "error.message exists");
            start();
          });
        });

      });

      describe(scenarioList[i] + ': insert/update test(s)', function() {

        // ref: litehelpers/Cordova-sqlite-storage#128
        // Was caused by a failure to create temporary transaction files on WP8.
        // Workaround by Mark Oppenheim mailto:mark.oppenheim@mnetics.co.uk
        // solved the issue for WP8.
        // @brodybits noticed similar issue possible with Android-sqlite-connector
        // if the Android-sqlite-native-driver part is not built correctly.
        test_it(suiteName + 'Multiple updates with key', function () {
          var db = openDatabase("MultipleUpdatesWithKey", "1.0",
"Demo", DEFAULT_SIZE);

          stop();

          db.transaction(function (tx) {
            tx.executeSql('DROP TABLE IF EXISTS Task');
            tx.executeSql('CREATE TABLE IF NOT EXISTS Task (id primary key, subject)');
            tx.executeSql('INSERT INTO Task VALUES (?,?)', ['928238b3-a227-418f-aa15-12bb1943c1f2', 'test1']);
            tx.executeSql('INSERT INTO Task VALUES (?,?)', ['511e3fb7-5aed-4c1a-b1b7-96bf9c5012e2', 'test2']);

            tx.executeSql('UPDATE Task SET subject="Send reminder", id="928238b3-a227-418f-aa15-12bb1943c1f2" WHERE id = "928238b3-a227-418f-aa15-12bb1943c1f2"', [], function(tx, res) {
              expect(res).toBeDefined();
              if (!isWindows) // XXX TODO
                expect(res.rowsAffected).toEqual(1);
            }, function (error) {
              ok(false, '1st update failed ' + error);
            });

            tx.executeSql('UPDATE Task SET subject="Task", id="511e3fb7-5aed-4c1a-b1b7-96bf9c5012e2" WHERE id = "511e3fb7-5aed-4c1a-b1b7-96bf9c5012e2"', [], function(tx, res) {
              //if (!isWindows) // XXX TODO
              expect(res.rowsAffected).toEqual(1);
            }, function (error) {
              ok(false, '2nd update failed ' + error);
            });
          }, function (error) {
            ok(false, 'transaction failed ' + error);
            start(1);
          }, function () {
            ok(true, 'transaction committed ok');
            start(1);
          });
        });

      });

    });
  }

  describe('Plugin: plugin-specific tx test(s)', function() {

    var scenarioList = [
      isAndroid ? 'Plugin-implementation-default' : 'Plugin',
      'Plugin-implementation-2'
    ];

    var scenarioCount = isAndroid ? 2 : 1;

    for (var i=0; i<scenarioCount; ++i) {

      describe(scenarioList[i] + ': plugin-specific sql test(s)', function() {
        var scenarioName = scenarioList[i];
        var suiteName = scenarioName + ': ';
        var isOldAndroidImpl = (i === 1);

        // NOTE: MUST be defined in function scope, NOT outer scope:
        var openDatabase = function(first, second, third, fourth, fifth, sixth) {
          if (!isOldAndroidImpl) {
            return window.sqlitePlugin.openDatabase(first, second, third, fourth, fifth, sixth);
          }

          var dbname, okcb, errorcb;

          if (first.constructor === String ) {
            dbname = first;
            okcb = fifth;
            errorcb = sixth;
          } else {
            dbname = first.name;
            okcb = second;
            errorcb = third;
          }

          dbopts = {
            name: 'i2-'+dbname,
            androidDatabaseImplementation: 2,
            androidLockWorkaround: 1
          };

          return window.sqlitePlugin.openDatabase(dbopts, okcb, errorcb);
        }

        test_it(suiteName + "DB String result test", function() {
          // NOTE: this test checks that for db.executeSql(), the result callback is
          // called exactly once, with the proper result:
          var db = openDatabase("DB-String-result-test.db", "1.0", "Demo", DEFAULT_SIZE);

          var expected = [ 'FIRST', 'SECOND' ];
          var i=0;

          ok(!!db, 'valid db object');

          stop(2);

          var okcb = function(result) {
            if (i > 1) {
              ok(false, "unexpected result: " + JSON.stringify(result));
              console.log("discarding unexpected result: " + JSON.stringify(result))
              return;
            }

            ok(!!result, "valid result object");

            // ignore cb (and do not count) if result is undefined:
            if (!!result) {
              console.log("result.rows.item(0).uppertext: " + result.rows.item(0).uppertext);
              equal(result.rows.item(0).uppertext, expected[i], "Check result " + i);
              i++;
              start(1);
            }
          };

          db.executeSql("select upper('first') as uppertext", [], okcb);
          db.executeSql("select upper('second') as uppertext", [], okcb);
        });

        test_it(suiteName + "PRAGMAs and multiple databases", function() {
          var db = openDatabase("DB1", "1.0", "Demo", DEFAULT_SIZE);

          var db2 = openDatabase("DB2", "1.0", "Demo", DEFAULT_SIZE);

          stop(2);

          db.transaction(function(tx) {
            tx.executeSql('DROP TABLE IF EXISTS test_table');
            tx.executeSql('CREATE TABLE IF NOT EXISTS test_table (id integer primary key, data text, data_num integer)', [], function() {
              console.log("test_table created");
            });

            stop();
            db.executeSql("pragma table_info (test_table);", [], function(res) {
              start();
              console.log("PRAGMA res: " + JSON.stringify(res));
              equal(res.rows.item(2).name, "data_num", "DB1 table number field name");
            });
          });

          db2.transaction(function(tx) {
            tx.executeSql('DROP TABLE IF EXISTS tt2');
            tx.executeSql('CREATE TABLE IF NOT EXISTS tt2 (id2 integer primary key, data2 text, data_num2 integer)', [], function() {
              console.log("tt2 created");
            });

            db.executeSql("pragma table_info (test_table);", [], function(res) {
              console.log("PRAGMA (db) res: " + JSON.stringify(res));
              equal(res.rows.item(0).name, "id", "DB1 table key field name");
              equal(res.rows.item(1).name, "data", "DB1 table text field name");
              equal(res.rows.item(2).name, "data_num", "DB1 table number field name");

              start();
            });

            db2.executeSql("pragma table_info (tt2);", [], function(res) {
              console.log("PRAGMA (tt2) res: " + JSON.stringify(res));
              equal(res.rows.item(0).name, "id2", "DB2 table key field name");
              equal(res.rows.item(1).name, "data2", "DB2 table text field name");
              equal(res.rows.item(2).name, "data_num2", "DB2 table number field name");

              start();
            });
          });
        });

      });
    }

  });

}

if (window.hasBrowser) mytests();
else exports.defineAutoTests = mytests;

/* vim: set expandtab : */
