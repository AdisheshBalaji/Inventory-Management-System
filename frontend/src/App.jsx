import { Route, Routes } from 'react-router-dom'
import Landing from './pages/landing'
import Login from './pages/login'
import Register from './pages/register'
import Dashboard from './pages/dashboard'
import CustomerLogin from './pages/customer-login'
import CustomerProducts from './pages/customer-products'
import Checkout from './pages/checkout'
import CustomerOrders from './pages/customer-orders'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/customer-login" element={<CustomerLogin />} />
      <Route path="/customer-products" element={<CustomerProducts />} />
      <Route path="/customer/checkout" element={<Checkout />} />
      <Route path="/customer-orders" element={<CustomerOrders />} />
    </Routes>
  )
}

export default App
