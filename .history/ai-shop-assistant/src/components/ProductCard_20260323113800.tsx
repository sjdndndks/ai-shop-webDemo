import type { Product } from "../types"
import defaultImg from '../defaultImg.jpg'
import { useCartStore } from "../store/cartStore"

export function ProductCard({product}:{product:Product}){
    const addToCart = useCartStore((state)=>state.addToCart)
    const increaseQuantity = useCartStore((state)=>state.increaseQuantity)
    const decreaseQuantity = useCartStore((state)=>state.decreaseQuantity)
    const quantity = useCartStore((state)=>
        state.items.find((item)=> item.id === product.id)?.quantity ?? 0
    )

    return(
        <div
        style={{
            border:'1px solid #eee',
            width:'200px',
            padding:'12px',
            borderRadius:'12px',
            backgroundColor:'white',
            boxShadow:'0 4px 6px rgba(0,0,0,0.05)'
        }}
        >
        {/* 渲染图片 */}
        <img 
            src={product.imageUrl}
            alt={product.name}
            style={
            {
                width:'120px',
                height:'120px',
                objectFit:'cover',
                borderRadius:'6px'
            }
            }
            onError={(e)=>{
            e.currentTarget.onerror = null
            e.currentTarget.src = defaultImg
            }}
        >
        </img>
        {/* 渲染名字 */}
        <h3 
            style={
            {fontSize:'16px',
                margin: '10px 0 5px 0',
                color:'grey'
            }
            }
        >
            {product.name}
        </h3>
        {/* 渲染价格 */}
        <p 
            style={
            {color:'#ff4d4f', 
            fontSize:'18px', 
            fontWeight:'bold',
            margin:'0 0 10px 0'}}>
            ¥{product.price}
        </p>
        {quantity === 0 ? (
            <button
                onClick={()=>addToCart(product)}
                style={
                {
                    width:'100%',
                    padding:'9px',
                    backgroundColor:'#ff4d4f',
                    color:'white',
                    border:'none',
                    borderRadius:'80px',
                    fontWeight:'bold',
                    boxShadow:'0 4px 8px rgba(0,0,0,0.2)',
                    cursor: 'pointer'
                }
                }
            >立即购买</button>
        ) : (
            <div
                style={{
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'space-between',
                    gap:'10px',
                    width:'100%',
                    padding:'8px 10px',
                    borderRadius:'80px',
                    border:'1px solid #ffd1d1',
                    backgroundColor:'#fff5f5'
                }}
            >
                <button
                    onClick={()=>decreaseQuantity(product.id)}
                    style={{
                        width:'34px',
                        height:'34px',
                        border:'none',
                        borderRadius:'50%',
                        backgroundColor:'#ff4d4f',
                        color:'white',
                        fontSize:'20px',
                        cursor:'pointer'
                    }}
                >
                    -
                </button>
                <div
                    style={{
                        display:'flex',
                        flexDirection:'column',
                        alignItems:'center',
                        color:'#ff4d4f'
                    }}
                >
                    <strong style={{ fontSize:'18px' }}>{quantity}</strong>
                    <span style={{ fontSize:'12px' }}>已购买</span>
                </div>
                <button
                    onClick={()=>increaseQuantity(product.id)}
                    style={{
                        width:'34px',
                        height:'34px',
                        border:'none',
                        borderRadius:'50%',
                        backgroundColor:'#ff4d4f',
                        color:'white',
                        fontSize:'20px',
                        cursor:'pointer'
                    }}
                >
                    +
                </button>
            </div>
        )}
        </div>
    )
}
