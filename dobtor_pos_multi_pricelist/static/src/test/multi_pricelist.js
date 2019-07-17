//var data = [{r:1, d:30, q:3},{r:2, d:50, q:1}, {r:2, d:50, q:1}, {r:3,d:10, q:3}]

/**ex: 
 *r2,r1 * 1
 *r2,r1,r3 * 1
 *r2,r1,r3,r4 *1
 *----------------------
 *r1,r3 *2
 *r1,r3,r4 *2
 *----------------------
 *r3,r4 *1
 */

var data = [{
    r: 1,
    d: 30,
    q: 3
}, {
    r: 2,
    d: 50,
    q: 1
}, {
    r: 3,
    d: 10,
    q: 3
}, {
    r: 4,
    d: 10,
    q: 2
}];
var sdata = _.sortBy(data, 'q');


var output = [];
var except_same_rule = [...sdata];

_.each(sdata, function (line) {
    console.log('line :', line)
    except_same_rule = _.filter(except_same_rule, (item) => item.r != line.r);
    console.log(except_same_rule);

    let np = 1;
    let last_np = (1 - line.d / 100);
    let rest_np
    let r = ''
    _.each(except_same_rule, function (oline) {
        let qty = 0;

        np = last_np * (1 - oline.d / 100);
        rest_np = last_np - np;
        last_np = np;
        if (line.q > oline.q) {
            qty = oline.q
        } else {
            qty = line.q
        }
        console.log(qty);
        r += ',' + oline.r
        console.log('r :', r)

        let G = _.groupBy(output, 'base_mix')
        var outs = [];
        _.each(Object.keys(G), (k) => {
            let mrl = _.max(G[k], mix => mix.r.length);
            outs.push(mrl);
        })

        let done = _.filter(outs, pfp => {
            console.log('pfp.base_mix :', pfp.base_mix);
            return pfp.other_mix.indexOf(',' + line.r + r) != -1 && pfp.base_mix != line.r
        });
        console.log('output  :', output)
        console.log('done  :', done)
        if (done.length) {
            qty = qty - _.reduce(_.pluck(done, 'q'), (memo, num) => memo + num, 0);
        }
        if (qty > 0) {
            output.push({
                r: line.r + r,
                q: qty,
                d: -rest_np,
                base_mix: line.r,
                other_mix: r,
            });
        }

    });
})
output