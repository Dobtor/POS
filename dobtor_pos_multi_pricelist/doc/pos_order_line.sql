with lines as (
    select line.id, line.name, line.product_id, line.price_unit, line.qty, line.price_subtotal, line.relation_product from pos_order_line as line 
    where line.order_id = 173
)

select lines.*, p.barcode from lines 
left join product_product as p on p.id = lines.product_id;