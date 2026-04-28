-- 상품 리뷰 4축 태그 집계 RPC
-- 4개 축(size/color/thickness/stretch) × 3개 옵션 = 최대 12행 반환
-- 각 축 내부 percentage 합 = 100 (해당 축 응답자 기준)
-- 응답이 0인 옵션도 0/0% 로 항상 포함 (UI 차트 정렬 안정성)

create or replace function public.get_product_review_tag_summary(p_product_id uuid)
returns table (
  axis text,
  "option" text,
  count bigint,
  percentage numeric
)
language sql
stable
as $$
  with options as (
    select 'size'::text as axis, unnest(array['약간 작아요', '딱 맞아요', '약간 커요']) as opt
    union all
    select 'color', unnest(array['화면보다 어두워요', '화면과 똑같아요', '화면보다 밝아요'])
    union all
    select 'thickness', unnest(array['얇아요', '적당해요', '두꺼워요'])
    union all
    select 'stretch', unnest(array['없어요', '적당해요', '많이 있어요'])
  ),
  responses as (
    select 'size'::text as axis, tag_size as opt
      from public.reviews where product_id = p_product_id and tag_size is not null
    union all
    select 'color', tag_color
      from public.reviews where product_id = p_product_id and tag_color is not null
    union all
    select 'thickness', tag_thickness
      from public.reviews where product_id = p_product_id and tag_thickness is not null
    union all
    select 'stretch', tag_stretch
      from public.reviews where product_id = p_product_id and tag_stretch is not null
  ),
  axis_totals as (
    select axis, count(*)::bigint as total from responses group by axis
  ),
  per_option as (
    select axis, opt, count(*)::bigint as cnt from responses group by axis, opt
  )
  select
    o.axis,
    o.opt as "option",
    coalesce(p.cnt, 0) as count,
    case
      when coalesce(t.total, 0) = 0 then 0::numeric
      else round(coalesce(p.cnt, 0)::numeric * 100 / t.total, 1)
    end as percentage
  from options o
  left join per_option p on p.axis = o.axis and p.opt = o.opt
  left join axis_totals t on t.axis = o.axis
  order by
    case o.axis when 'size' then 1 when 'color' then 2 when 'thickness' then 3 when 'stretch' then 4 end,
    case o.axis
      when 'size' then array_position(array['약간 작아요', '딱 맞아요', '약간 커요'], o.opt)
      when 'color' then array_position(array['화면보다 어두워요', '화면과 똑같아요', '화면보다 밝아요'], o.opt)
      when 'thickness' then array_position(array['얇아요', '적당해요', '두꺼워요'], o.opt)
      when 'stretch' then array_position(array['없어요', '적당해요', '많이 있어요'], o.opt)
    end;
$$;

-- 익명 사용자도 호출 가능 (PDP는 비로그인 노출)
grant execute on function public.get_product_review_tag_summary(uuid) to anon, authenticated;
