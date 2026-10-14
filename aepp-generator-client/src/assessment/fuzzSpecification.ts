import { z } from 'zod'
const name=z.string().min(1).max(100)
const range={min:z.number().finite().optional(),max:z.number().finite().optional()}
const validRange=(r:{min?:number;max?:number})=>r.min===undefined||r.max===undefined||r.min<=r.max
export const FuzzSpecificationSchema=z.object({
  scalars:z.array(z.object({name,type:z.enum(['integer','real','string','boolean']),...range,allowed:z.array(z.string().max(1000)).min(1).max(100).optional(),role:z.enum(['value','searchKey','count']).default('value')}).refine(validRange)).max(100).default([]),
  arrays:z.array(z.object({name,countVariable:name.optional(),minLength:z.number().int().min(1).max(1000).default(1),maxLength:z.number().int().min(1).max(1000).default(1000),...range,sorted:z.enum(['ascending','descending']).optional()}).refine(r=>validRange(r)&&r.minLength<=r.maxLength)).max(30).default([]),
})
export type FuzzSpecification=z.infer<typeof FuzzSpecificationSchema>
